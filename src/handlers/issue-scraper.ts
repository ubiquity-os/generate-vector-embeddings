import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { VoyageAIClient } from "voyageai";
import { Octokit } from "@octokit/rest";
import markdownit from "markdown-it";
import plainTextPlugin from "markdown-it-plain-text";
import "dotenv/config";

// Check required environment variables
function checkEnvVars() {
  const required = ["GITHUB_TOKEN", "SUPABASE_URL", "SUPABASE_KEY", "VOYAGEAI_API_KEY"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

interface MarkdownItWithPlainText extends markdownit {
  plainText: string;
}

function markdownToPlainText(markdown: string | null): string | null {
  if (!markdown) {
    return markdown;
  }
  const md = markdownit() as MarkdownItWithPlainText;
  md.use(plainTextPlugin);
  md.render(markdown);
  return md.plainText;
}

function createAdapters(voyage: VoyageAIClient) {
  return {
    voyage: {
      embedding: {
        createEmbedding: async (text: string | null) => {
          if (text === null) {
            throw new Error("Text is null");
          }
          const response = await voyage.embed({
            input: text,
            model: "voyage-large-2-instruct",
            inputType: "document",
          });
          return (response.data && response.data[0]?.embedding) || [];
        },
      },
    },
  };
}

interface IssueMetadata {
  id: string;
  nodeId: string;
  number: number;
  title: string;
  body: string;
  state: string;
  organizationName: string | null;
  organizationId: number | null;
  repositoryName: string;
  repositoryId: number;
  assignees: string[];
  authorId: string;
  createdAt: string;
  closedAt: string | null;
  stateReason: string | null;
  updatedAt: string;
}

interface IssueNode {
  id: string;
  nodeId: string;
  number: number;
  title: string;
  body: string;
  state: string;
  stateReason: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  author: {
    id?: string;
  } | null;
  assignees: {
    nodes: Array<{
      login: string;
    }>;
  };
}

interface GraphQlResponse {
  viewer?: {
    organizations: {
      nodes: Array<{
        id: string | null;
        login: string | null;
        repositories: {
          nodes: Array<{
            id: string | null;
            name: string | null;
            issues: {
              nodes: Array<IssueNode>;
            };
          }>;
        };
      }>;
    };
  };
  user?: {
    repositories: {
      nodes: Array<{
        id: string | null;
        name: string | null;
        owner: {
          id: string;
          login: string;
        };
        issues: {
          nodes: Array<IssueNode>;
        };
      }>;
    };
  };
}

const ORGANIZATION_ISSUES_QUERY = `
  query {
    viewer {
      organizations(first: 10) {
        nodes {
          id
          login
          repositories(first: 50) {
            nodes {
              id
              name
              issues(states: CLOSED, first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
                pageInfo {
                  hasNextPage
                  endCursor
                }
                nodes {
                  id
                  nodeId: id
                  number
                  title
                  body
                  state
                  stateReason
                  createdAt
                  updatedAt
                  closedAt
                  author {
                    ... on User {
                      id
                    }
                  }
                  assignees(first: 10) {
                    nodes {
                      ... on User {
                        login
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const USER_ISSUES_QUERY = `
  query($username: String!) {
    user(login: $username) {
      repositories(first: 50) {
        nodes {
          id
          name
          owner {
            id
            login
          }
          issues(states: CLOSED, first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              id
              nodeId: id
              number
              title
              body
              state
              stateReason
              createdAt
              updatedAt
              closedAt
              author {
                ... on User {
                  id
                }
              }
              assignees(first: 10) {
                nodes {
                  ... on User {
                    login
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

interface ProcessingStats {
  totalOrgs: number;
  accessibleOrgs: number;
  totalRepos: number;
  accessibleRepos: number;
  totalIssues: number;
  processedIssues: number;
  updatedIssues: number;
  newIssues: number;
  errors: Array<{
    type: "org" | "repo" | "issue";
    name: string;
    error: string;
  }>;
}

interface DatabaseIssue {
  id: string;
  markdown: string;
  plaintext: string;
  payload: Record<string, unknown>;
  modified_at: string;
}

async function getExistingIssues(supabase: SupabaseClient): Promise<Map<string, DatabaseIssue>> {
  const { data, error } = await supabase.from("issues").select("id, markdown, plaintext, payload, modified_at");

  if (error) {
    throw new Error(`Failed to fetch existing issues: ${error.message}`);
  }

  return new Map(data.map((issue: DatabaseIssue) => [issue.id, issue]));
}

const ERROR_MESSAGES = {
  UNKNOWN: "Unknown error",
  INCOMPLETE_REPO: "Repository data is incomplete or inaccessible",
  INCOMPLETE_ORG: "Organization data is incomplete or inaccessible",
};

async function fetchAllClosedIssues(
  octokit: Octokit,
  existingIssues: Map<string, DatabaseIssue>,
  username?: string
): Promise<{ issues: IssueMetadata[]; stats: ProcessingStats }> {
  const stats: ProcessingStats = {
    totalOrgs: 0,
    accessibleOrgs: 0,
    totalRepos: 0,
    accessibleRepos: 0,
    totalIssues: 0,
    processedIssues: 0,
    updatedIssues: 0,
    newIssues: 0,
    errors: [],
  };

  try {
    const response = await octokit.graphql<GraphQlResponse>(username ? USER_ISSUES_QUERY : ORGANIZATION_ISSUES_QUERY, username ? { username } : {});
    const allIssues: IssueMetadata[] = [];

    if (username && response.user) {
      // Process user repositories
      const repos = response.user.repositories.nodes;
      stats.totalRepos = repos.length;

      for (const repo of repos) {
        try {
          if (!repo.id || !repo.name) {
            stats.errors.push({
              type: "repo",
              name: `${repo.owner.login}/${repo.name || "unknown"}`,
              error: ERROR_MESSAGES.INCOMPLETE_REPO,
            });
            continue;
          }
          stats.accessibleRepos++;

          const issues = repo.issues.nodes;
          stats.totalIssues += issues.length;

          for (const issue of issues) {
            try {
              const STATE_REASON_COMPLETED = "COMPLETED";
              if (issue.stateReason === STATE_REASON_COMPLETED) {
                const existingIssue = existingIssues.get(issue.nodeId);
                const isUpdated = existingIssue && new Date(issue.updatedAt) > new Date(existingIssue.modified_at);

                if (isUpdated) {
                  stats.updatedIssues++;
                } else if (!existingIssue) {
                  stats.newIssues++;
                }

                allIssues.push({
                  id: issue.id,
                  nodeId: issue.nodeId,
                  number: issue.number,
                  title: issue.title || "",
                  body: issue.body || "",
                  state: issue.state,
                  stateReason: issue.stateReason,
                  organizationName: null,
                  organizationId: null,
                  repositoryName: repo.name,
                  repositoryId: parseInt(repo.id),
                  assignees: (issue.assignees?.nodes || []).map((assignee) => assignee.login),
                  authorId: issue.author?.id || "unknown",
                  createdAt: issue.createdAt,
                  closedAt: issue.closedAt,
                  updatedAt: issue.updatedAt,
                });
                stats.processedIssues++;
              }
            } catch (error) {
              stats.errors.push({
                type: "issue",
                name: `${repo.owner.login}/${repo.name}#${issue.number}`,
                error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN,
              });
            }
          }
        } catch (error) {
          stats.errors.push({
            type: "repo",
            name: `${repo.owner.login}/${repo.name || "unknown"}`,
            error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN,
          });
        }
      }
    } else if (response.viewer) {
      // Process organization repositories
      const orgs = response.viewer.organizations.nodes;
      stats.totalOrgs = orgs.length;

      for (const org of orgs) {
        try {
          if (!org.id || !org.login) {
            stats.errors.push({
              type: "org",
              name: org.login || "unknown",
              error: ERROR_MESSAGES.INCOMPLETE_ORG,
            });
            continue;
          }
          stats.accessibleOrgs++;

          const repos = org.repositories.nodes;
          stats.totalRepos += repos.length;

          for (const repo of repos) {
            try {
              if (!repo.id || !repo.name) {
                stats.errors.push({
                  type: "repo",
                  name: `${org.login}/${repo.name || "unknown"}`,
                  error: ERROR_MESSAGES.INCOMPLETE_REPO,
                });
                continue;
              }
              stats.accessibleRepos++;

              const issues = repo.issues.nodes;
              stats.totalIssues += issues.length;

              for (const issue of issues) {
                try {
                  const STATE_REASON_COMPLETED = "COMPLETED";
                  if (issue.stateReason === STATE_REASON_COMPLETED) {
                    const existingIssue = existingIssues.get(issue.nodeId);
                    const isUpdated = existingIssue && new Date(issue.updatedAt) > new Date(existingIssue.modified_at);

                    if (isUpdated) {
                      stats.updatedIssues++;
                    } else if (!existingIssue) {
                      stats.newIssues++;
                    }

                    allIssues.push({
                      id: issue.id,
                      nodeId: issue.nodeId,
                      number: issue.number,
                      title: issue.title || "",
                      body: issue.body || "",
                      state: issue.state,
                      stateReason: issue.stateReason,
                      organizationName: org.login,
                      organizationId: parseInt(org.id),
                      repositoryName: repo.name,
                      repositoryId: parseInt(repo.id),
                      assignees: (issue.assignees?.nodes || []).map((assignee) => assignee.login),
                      authorId: issue.author?.id || "unknown",
                      createdAt: issue.createdAt,
                      closedAt: issue.closedAt,
                      updatedAt: issue.updatedAt,
                    });
                    stats.processedIssues++;
                  }
                } catch (error) {
                  stats.errors.push({
                    type: "issue",
                    name: `${org.login}/${repo.name}#${issue.number}`,
                    error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN,
                  });
                }
              }
            } catch (error) {
              stats.errors.push({
                type: "repo",
                name: `${org.login}/${repo.name || "unknown"}`,
                error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN,
              });
            }
          }
        } catch (error) {
          stats.errors.push({
            type: "org",
            name: org.login || "unknown",
            error: error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN,
          });
        }
      }
    }

    return { issues: allIssues, stats };
  } catch (error) {
    throw new Error(`Failed to fetch issues: ${error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN}`);
  }
}

export async function issueScraper(token?: string, username?: string): Promise<string> {
  try {
    // Check environment variables first
    checkEnvVars();

    // Get token from env if not provided
    const githubToken = token || process.env.GITHUB_TOKEN;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    const voyageApiKey = process.env.VOYAGEAI_API_KEY;

    if (!supabaseUrl || !supabaseKey || !voyageApiKey) {
      throw new Error("Required environment variables are missing");
    }

    // Initialize clients
    const supabase = createClient(supabaseUrl, supabaseKey);
    const voyageClient = new VoyageAIClient({
      apiKey: voyageApiKey,
    });
    const octokit = new Octokit({ auth: githubToken });

    const adapters = createAdapters(voyageClient);

    // Get existing issues from database
    const existingIssues = await getExistingIssues(supabase);

    // Fetch closed issues from all accessible organizations and repositories
    const { issues, stats } = await fetchAllClosedIssues(octokit, existingIssues, username);

    // Process each issue
    const processedIssues: Array<{ issue: IssueMetadata; status: string; error?: string }> = [];

    for (const issue of issues) {
      try {
        const markdown = issue.body + " " + issue.title;
        const plaintext = markdownToPlainText(markdown);

        // Generate embedding
        const embedding = await adapters.voyage.embedding.createEmbedding(plaintext);

        const existingIssue = existingIssues.get(issue.nodeId);
        let status = "unchanged";
        if (existingIssue) {
          if (new Date(issue.updatedAt) > new Date(existingIssue.modified_at)) {
            status = "updated";
          }
        } else {
          status = "new";
        }

        // Store in Supabase
        const { error } = await supabase.from("issues").upsert({
          id: issue.nodeId,
          markdown,
          plaintext,
          embedding: JSON.stringify(embedding),
          author_id: issue.authorId,
          modified_at: issue.updatedAt,
          payload: {
            issue_number: issue.number,
            organization_name: issue.organizationName,
            organization_id: issue.organizationId,
            repository_name: issue.repositoryName,
            repository_id: issue.repositoryId,
            assignees: issue.assignees,
            state: issue.state,
            state_reason: issue.stateReason,
            created_at: issue.createdAt,
            closed_at: issue.closedAt,
            modified_at: issue.updatedAt,
          },
        });

        processedIssues.push({
          issue,
          status,
          error: error ? `Error storing issue: ${error.message}` : undefined,
        });
      } catch (error) {
        processedIssues.push({
          issue,
          status: "failed",
          error: `Error processing issue: ${error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN}`,
        });
      }
    }

    return JSON.stringify(
      {
        success: true,
        stats: {
          ...stats,
          storageSuccessful: processedIssues.filter((p) => !p.error).length,
          storageFailed: processedIssues.filter((p) => p.error).length,
        },
        errors: [
          ...stats.errors,
          ...processedIssues
            .filter((p) => p.error)
            .map((p) => ({
              type: "storage",
              name: `${p.issue.organizationName}/${p.issue.repositoryName}#${p.issue.number}`,
              error: p.error || ERROR_MESSAGES.UNKNOWN,
            })),
        ],
        issues: processedIssues.map((p) => ({
          number: p.issue.number,
          title: p.issue.title,
          org: p.issue.organizationName,
          repo: p.issue.repositoryName,
          status: p.status,
          error: p.error,
        })),
      },
      null,
      2
    );
  } catch (error) {
    console.error("Error in issueScraper:", error);
    throw error;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  let username: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--username" || args[i] === "-u") {
      username = args[i + 1];
      i++;
    }
  }

  return { username };
}

// CLI Mode
const { username } = parseArgs();
if (username) {
  console.log(`Fetching issues for user: ${username}`);
}

issueScraper(undefined, username)
  .then((result) => console.log(result))
  .catch((error) => {
    console.error("Error running issue scraper:", error);
    process.exit(1);
  });
