import { IssueSimilaritySearchResult } from "../adapters/supabase/helpers/issues";
import { Context } from "../types";
import { IssuePayload } from "../types/payload";

export interface IssueGraphqlResponse {
  node: {
    title: string;
    url: string;
    body: string;
    repository: {
      name: string;
      owner: {
        login: string;
      };
    };
  };
  similarity: string;
  mostSimilarSentence: { sentence: string; similarity: number; index: number };
}

/**
 * Checks if the current issue is a duplicate of an existing issue.
 * If a similar issue is found, a comment is added to the current issue.
 * @param context The context object
 * @returns True if a similar issue is found, false otherwise
 **/
export async function issueChecker(context: Context): Promise<boolean> {
  const {
    logger,
    adapters: { supabase },
    octokit,
  } = context;
  const { payload } = context as { payload: IssuePayload };
  const issue = payload.issue;
  const similarIssues = await supabase.issue.findSimilarIssues(issue.title + removeFootnotes(issue.body || ""), context.config.warningThreshold, issue.node_id);
  if (similarIssues && similarIssues.length > 0) {
    const matchIssues = similarIssues.filter((issue) => issue.similarity >= context.config.matchThreshold);

    if (matchIssues.length > 0) {
      logger.info(`Similar issue which matches more than ${context.config.matchThreshold} already exists`);
      await octokit.issues.update({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: issue.number,
        state: "closed",
        state_reason: "not_planned",
      });
    }

    if (similarIssues.length > 0) {
      logger.info(`Similar issue which matches more than ${context.config.warningThreshold} already exists`);
      await handleSimilarIssuesComment(context, payload, issue.number, similarIssues);
      return true;
    }
  }

  return false;
}

function matchRepoOrgToSimilarIssueRepoOrg(repoOrg: string, similarIssueRepoOrg: string, repoName: string, similarIssueRepoName: string): boolean {
  return repoOrg === similarIssueRepoOrg && repoName === similarIssueRepoName;
}

/**
 * Finds the most similar sentence in a similar issue to a sentence in the current issue.
 * @param issueContent The content of the current issue
 * @param similarIssueContent The content of the similar issue
 * @returns The most similar sentence and its similarity score
 */
function findMostSimilarSentence(issueContent: string, similarIssueContent: string): { sentence: string; similarity: number; index: number } {
  const issueSentences = issueContent.split(/[.!?]+/).filter((sentence) => sentence.trim().length > 0);
  const similarIssueSentences = similarIssueContent.split(/[.!?]+/).filter((sentence) => sentence.trim().length > 0);
  let maxSimilarity = 0;
  let mostSimilarSentence;
  let mostSimilarIndex = -1;
  issueSentences.forEach((sentence, index) => {
    const similarities = similarIssueSentences.map((similarSentence) => {
      const editDistance = findEditDistance(sentence, similarSentence);
      const maxLength = Math.max(sentence.length, similarSentence.length);
      // Normalized similarity (edit distance)
      return 1 - editDistance / maxLength;
    });
    const maxSentenceSimilarity = Math.max(...similarities);
    if (maxSentenceSimilarity > maxSimilarity) {
      maxSimilarity = maxSentenceSimilarity;
      mostSimilarSentence = sentence;
      mostSimilarIndex = index;
    }
  });
  if (!mostSimilarSentence) {
    throw new Error("No similar sentence found");
  }
  return { sentence: mostSimilarSentence, similarity: maxSimilarity, index: mostSimilarIndex };
}

async function handleSimilarIssuesComment(context: Context, payload: IssuePayload, issueNumber: number, similarIssues: IssueSimilaritySearchResult[]) {
  const issueList: IssueGraphqlResponse[] = await Promise.all(
    similarIssues.map(async (issue: IssueSimilaritySearchResult) => {
      const issueUrl: IssueGraphqlResponse = await context.octokit.graphql(
        `query($issueNodeId: ID!) {
          node(id: $issueNodeId) {
            ... on Issue {
              title
              url
              body
              repository {
                name
                owner {
                  login
                }
              }
            }
          }
        }`,
        { issueNodeId: issue.issue_id }
      );
      issueUrl.similarity = Math.round(issue.similarity * 100).toString();
      issueUrl.mostSimilarSentence = findMostSimilarSentence(context.payload.issue.body || "", issueUrl.node.body);
      return issueUrl;
    })
  );

  const relevantIssues = issueList.filter((issue) =>
    matchRepoOrgToSimilarIssueRepoOrg(payload.repository.owner.login, issue.node.repository.owner.login, payload.repository.name, issue.node.repository.name)
  );

  if (relevantIssues.length === 0) {
    return;
  }

  const issueBody = context.payload.issue.body || "";
  // Find existing footnotes in the body
  const footnoteRegex = /\[\^(\d+)\^\]/g;
  const existingFootnotes = issueBody.match(footnoteRegex) || [];
  const highestFootnoteIndex = existingFootnotes.length > 0 ? Math.max(...existingFootnotes.map((fn) => parseInt(fn.match(/\d+/)?.[0] ?? "0"))) : 0;
  let updatedBody = issueBody;
  let footnotes: string[] | undefined;
  relevantIssues.forEach((issue, index) => {
    const footnoteIndex = highestFootnoteIndex + index + 1; // Continue numbering from the highest existing footnote number
    const footnoteRef = `[^0${footnoteIndex}^]`;
    const modifiedUrl = issue.node.url.replace("https://github.com", "https://www.github.com");
    const { sentence } = issue.mostSimilarSentence;

    // Insert footnote reference in the body
    const sentencePattern = new RegExp(`${sentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g");
    updatedBody = updatedBody.replace(sentencePattern, `${sentence}${footnoteRef}`);

    // Initialize footnotes array if not already done
    if (!footnotes) {
      footnotes = [];
    }

    // Add new footnote to the array
    footnotes.push(`${footnoteRef}: ⚠ ${issue.similarity}% possible duplicate - [${issue.node.title}](${modifiedUrl})\n\n`);
  });

  // Append new footnotes to the body, keeping the previous ones
  updatedBody += footnotes ? footnotes.join("") : "";

  // Update the issue with the modified body
  await context.octokit.issues.update({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: issueNumber,
    body: updatedBody,
  });
}

/**
 * Finds the edit distance between two strings using dynamic programming.
 * @param sentenceA
 * @param sentenceB
 * @returns
 */
function findEditDistance(sentenceA: string, sentenceB: string): number {
  const m = sentenceA.length;
  const n = sentenceB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array.from({ length: n + 1 }, () => 0));

  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      if (i === 0) {
        dp[i][j] = j;
      } else if (j === 0) {
        dp[i][j] = i;
      } else if (sentenceA[i - 1] === sentenceB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Removes all footnotes from the issue content.
 * This includes both the footnote references in the body and the footnote definitions at the bottom.
 * @param content The content of the issue
 * @returns The content without footnotes
 */
function removeFootnotes(content: string): string {
  // Remove footnote references like [^1^], [^2^], etc.
  const footnoteRefRegex = /\[\^\d+\^\]/g;
  const contentWithoutFootnoteRefs = content.replace(footnoteRefRegex, "");

  // Remove footnote section starting with '###### Similar Issues' or any other footnote-related section
  const footnoteSectionRegex = /\n###### Similar Issues[\s\S]*$/g;
  return contentWithoutFootnoteRefs.replace(footnoteSectionRegex, "");
}
