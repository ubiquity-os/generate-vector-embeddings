// cSpell:disable

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import { drop } from "@mswjs/data";
import { Octokit } from "@octokit/rest";
import { Logs } from "@ubiquity-os/ubiquity-os-logger";
import { STRINGS } from "./__mocks__/strings";
import { createComment, createIssue, setupTests, fetchSimilarIssues } from "./__mocks__/helpers";
import dotenv from "dotenv";
import { runPlugin } from "../src/plugin";
import { Env } from "../src/types";
import { Context, SupportedEvents } from "../src/types/context";
import { CommentMock, createMockAdapters } from "./__mocks__/adapter";
import { db } from "./__mocks__/db";
import { server } from "./__mocks__/node";

dotenv.config();
jest.requireActual("@octokit/rest");
jest.requireActual("@supabase/supabase-js");
const octokit = new Octokit();

beforeAll(() => {
  server.listen();
});
afterEach(() => {
  server.resetHandlers();
  jest.clearAllMocks();
});
afterAll(() => server.close());

describe("Plugin tests", () => {
  beforeEach(async () => {
    drop(db);
    await setupTests();
  });

  it("When a comment is created it should add it to the database", async () => {
    const { context } = createContext(STRINGS.HELLO_WORLD, 1, 1, 1, "sasasCreate");
    await runPlugin(context);
    const supabase = context.adapters.supabase;
    const commentObject = null;
    try {
      await supabase.comment.createComment(STRINGS.HELLO_WORLD, "sasasCreate", 1, commentObject, false, "sasasCreateIssue");
      throw new Error("Expected method to reject.");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toBe("Comment already exists");
      }
    }
    const comment = (await supabase.comment.getComment("sasasCreate")) as unknown as CommentMock;
    expect(comment).toBeDefined();
    expect(comment?.plaintext).toBeDefined();
    expect(comment?.plaintext).toBe(STRINGS.HELLO_WORLD);
  });

  it("When a comment is updated it should update the database", async () => {
    const { context } = createContext("Updated Message", 1, 1, 1, "sasasUpdate", "1", "issue_comment.edited");
    const supabase = context.adapters.supabase;
    const commentObject = null;
    await supabase.comment.createComment(STRINGS.HELLO_WORLD, "sasasUpdate", 1, commentObject, false, "sasasUpdateIssue");
    await runPlugin(context);
    const comment = (await supabase.comment.getComment("sasasUpdate")) as unknown as CommentMock;
    expect(comment).toBeDefined();
    expect(comment?.plaintext).toBeDefined();
    expect(comment?.plaintext).toBe("Updated Message");
  });

  it("When a comment is deleted it should delete it from the database", async () => {
    const { context } = createContext("Text Message", 1, 1, 1, "sasasDelete", "1", "issue_comment.deleted");
    const supabase = context.adapters.supabase;
    const commentObject = null;
    await supabase.comment.createComment(STRINGS.HELLO_WORLD, "sasasDelete", 1, commentObject, false, "sasasDeleteIssue");
    await runPlugin(context);
    try {
      await supabase.comment.getComment("sasasDelete");
      throw new Error("Expected method to reject.");
    } catch (error) {
      if (error instanceof Error) {
        expect(error.message).toBe("Comment does not exist");
      }
    }
  });

  it("When an issue is created with similarity above warning threshold but below match threshold, it should update the issue body with footnotes", async () => {
    const [warningThresholdIssue1, warningThresholdIssue2] = fetchSimilarIssues("warning_threshold_75");
    const { context } = createContextIssues(warningThresholdIssue1.issue_body, "warning1", 3, warningThresholdIssue1.title);

    context.adapters.supabase.issue.findSimilarIssues = jest.fn().mockResolvedValue([]);
    context.adapters.supabase.issue.createIssue = jest.fn(async () => {
      createIssue(
        warningThresholdIssue1.issue_body,
        "warning1",
        warningThresholdIssue1.title,
        3,
        { login: "test", id: 1 },
        "open",
        null,
        STRINGS.TEST_REPO,
        STRINGS.USER_1
      );
    });

    await runPlugin(context);

    const { context: context2 } = createContextIssues(warningThresholdIssue2.issue_body, "warning2", 4, warningThresholdIssue2.title);
    context2.adapters.supabase.issue.findSimilarIssues = jest.fn().mockResolvedValue([{ issue_id: "warning1", similarity: 0.8 }]);

    context2.octokit.graphql = jest.fn().mockResolvedValue({
      node: {
        title: STRINGS.SIMILAR_ISSUE,
        url: `https://github.com/${STRINGS.USER_1}/${STRINGS.TEST_REPO}/issues/3`,
        number: 3,
        body: warningThresholdIssue1.issue_body,
        repository: {
          name: STRINGS.TEST_REPO,
          owner: {
            login: STRINGS.USER_1,
          },
        },
      },
    }) as unknown as typeof context2.octokit.graphql;

    context2.adapters.supabase.issue.createIssue = jest.fn(async () => {
      createIssue(
        warningThresholdIssue2.issue_body,
        "warning2",
        warningThresholdIssue2.title,
        4,
        { login: "test", id: 1 },
        "open",
        null,
        STRINGS.TEST_REPO,
        STRINGS.USER_1
      );
    });

    context2.octokit.issues.update = jest.fn(async (params: { owner: string; repo: string; issue_number: number; body: string }) => {
      // Find the most similar sentence (first sentence in this case)
      const sentence = "Description: The Java service layer's performance deteriorates under high load, partly due to the absence of effective caching.";
      const updatedBody =
        warningThresholdIssue2.issue_body.replace(sentence, `${sentence}[^01^]`) +
        `\n\n[^01^]: ⚠ 80% possible duplicate - [${STRINGS.SIMILAR_ISSUE}](https://github.com/${STRINGS.USER_1}/${STRINGS.TEST_REPO}/issues/3#3)\n\n`;

      db.issue.update({
        where: {
          number: { equals: params.issue_number },
        },
        data: {
          body: updatedBody,
        },
      });
    }) as unknown as typeof octokit.issues.update;

    await runPlugin(context2);

    const issue = db.issue.findFirst({ where: { node_id: { equals: "warning2" } } }) as unknown as Context["payload"]["issue"];
    expect(issue.state).toBe("open");
    expect(issue.body).toContain(
      `[^01^]: ⚠ 80% possible duplicate - [${STRINGS.SIMILAR_ISSUE}](https://github.com/${STRINGS.USER_1}/${STRINGS.TEST_REPO}/issues/3#3)`
    );
  });

  it("When an issue is created with similarity above match threshold, it should close the issue and add a caution alert", async () => {
    const [matchThresholdIssue1, matchThresholdIssue2] = fetchSimilarIssues("match_threshold_95");
    const { context } = createContextIssues(matchThresholdIssue1.issue_body, "match1", 3, matchThresholdIssue1.title);
    context.adapters.supabase.issue.findSimilarIssues = jest.fn().mockResolvedValue([]);
    context.adapters.supabase.issue.createIssue = jest.fn(async () => {
      createIssue(
        matchThresholdIssue1.issue_body,
        "match1",
        matchThresholdIssue1.title,
        3,
        { login: "test", id: 1 },
        "open",
        null,
        STRINGS.TEST_REPO,
        STRINGS.USER_1
      );
    });
    await runPlugin(context);
    const { context: context2 } = createContextIssues(matchThresholdIssue2.issue_body, "match2", 4, matchThresholdIssue2.title);

    // Mock the findSimilarIssues function to return a result with similarity above match threshold
    context2.adapters.supabase.issue.findSimilarIssues = jest.fn().mockResolvedValue([{ issue_id: "match1", similarity: 0.96 }]);
    context2.octokit.graphql = jest.fn().mockResolvedValue({
      node: {
        title: STRINGS.SIMILAR_ISSUE,
        url: `https://github.com/${STRINGS.USER_1}/${STRINGS.TEST_REPO}/issues/3`,
        number: 3,
        body: matchThresholdIssue1.issue_body,
        repository: {
          name: STRINGS.TEST_REPO,
          owner: {
            login: STRINGS.USER_1,
          },
        },
      },
    }) as unknown as typeof context2.octokit.graphql;

    context2.adapters.supabase.issue.createIssue = jest.fn(async () => {
      createIssue(
        matchThresholdIssue2.issue_body,
        "match2",
        matchThresholdIssue2.title,
        4,
        { login: "test", id: 1 },
        "open",
        null,
        STRINGS.TEST_REPO,
        STRINGS.USER_1
      );
    });

    context2.octokit.issues.update = jest.fn(
      async (params: { owner: string; repo: string; issue_number: number; body?: string; state?: string; state_reason?: string }) => {
        const updatedBody = `${matchThresholdIssue2.issue_body}\n\n>[!CAUTION]\n> This issue may be a duplicate of the following issues:\n> - [${STRINGS.SIMILAR_ISSUE}](https://github.com/${STRINGS.USER_1}/${STRINGS.TEST_REPO}/issues/3#3)\n`;
        db.issue.update({
          where: {
            number: { equals: params.issue_number },
          },
          data: {
            ...(params.body && { body: updatedBody }),
            ...(params.state && { state: params.state }),
            ...(params.state_reason && { state_reason: params.state_reason }),
          },
        });
      }
    ) as unknown as typeof octokit.issues.update;

    await runPlugin(context2);
    const issue = db.issue.findFirst({ where: { number: { equals: 4 } } }) as unknown as Context["payload"]["issue"];
    expect(issue.state).toBe("closed");
    expect(issue.state_reason).toBe("not_planned");
    expect(issue.body).toContain(">[!CAUTION]");
    expect(issue.body).toContain("This issue may be a duplicate of the following issues:");
    expect(issue.body).toContain(`- [${STRINGS.SIMILAR_ISSUE}](https://github.com/${STRINGS.USER_1}/${STRINGS.TEST_REPO}/issues/3#3)`);
  });

  it("When issue matching is triggered, it should suggest contributors based on similarity", async () => {
    const [taskCompleteIssue] = fetchSimilarIssues("task_complete");
    const { context } = createContextIssues(taskCompleteIssue.issue_body, "task_complete", 3, taskCompleteIssue.title);

    context.adapters.supabase.issue.createIssue = jest.fn(async () => {
      createIssue(
        taskCompleteIssue.issue_body,
        "task_complete",
        taskCompleteIssue.title,
        3,
        { login: "test", id: 1 },
        "open",
        null,
        STRINGS.TEST_REPO,
        STRINGS.USER_1
      );
    });

    // Mock the findSimilarIssues function to return predefined similar issues
    context.adapters.supabase.issue.findSimilarIssues = jest.fn().mockResolvedValue([{ id: "similar3", similarity: 0.98 }]);

    // Mock the graphql function to return predefined issue data
    context.octokit.graphql = jest.fn().mockResolvedValue({
      node: {
        title: "Similar Issue",
        url: `https://github.com/${STRINGS.USER_1}/${STRINGS.TEST_REPO}/issues/1`,
        state: "closed",
        stateReason: "COMPLETED",
        closed: true,
        repository: { owner: { login: STRINGS.USER_1 }, name: STRINGS.TEST_REPO },
        assignees: { nodes: [{ login: "contributor1", url: "https://github.com/contributor1" }] },
      },
    }) as unknown as typeof context.octokit.graphql;

    context.octokit.issues.createComment = jest.fn(async (params: { owner: string; repo: string; issue_number: number; body: string }) => {
      createComment(params.body, 1, "task_complete", params.issue_number);
    }) as unknown as typeof octokit.issues.createComment;

    await runPlugin(context);

    const comments = db.issueComments.findMany({ where: { node_id: { equals: "task_complete" } } });
    expect(comments.length).toBe(1);
    expect(comments[0].body).toContain("The following contributors may be suitable for this task:");
    expect(comments[0].body).toContain("contributor1");
    expect(comments[0].body).toContain("98% Match");
  });

  function createContext(
    commentBody: string = "Hello, world!",
    repoId: number = 1,
    payloadSenderId: number = 1,
    commentId: number = 1,
    nodeId: string = "sasas",
    issueNodeId: string = "1",
    eventName: Context["eventName"] = "issue_comment.created"
  ) {
    const repo = db.repo.findFirst({ where: { id: { equals: repoId } } }) as unknown as Context["payload"]["repository"];
    const sender = db.users.findFirst({ where: { id: { equals: payloadSenderId } } }) as unknown as Context["payload"]["sender"];
    const issue1 = db.issue.findFirst({ where: { node_id: { equals: issueNodeId } } }) as unknown as Context["payload"]["issue"];
    createComment(commentBody, commentId, nodeId);
    const comment = db.issueComments.findFirst({
      where: { id: { equals: commentId } },
    }) as unknown as unknown as SupportedEvents["issue_comment.created"]["payload"]["comment"];

    const context = createContextInner(repo, sender, issue1, comment, eventName);
    context.adapters = createMockAdapters(context) as unknown as Context["adapters"];
    const infoSpy = jest.spyOn(context.logger, "info");
    const errorSpy = jest.spyOn(context.logger, "error");
    const debugSpy = jest.spyOn(context.logger, "debug");
    const okSpy = jest.spyOn(context.logger, "ok");
    const verboseSpy = jest.spyOn(context.logger, "verbose");

    return {
      context,
      infoSpy,
      errorSpy,
      debugSpy,
      okSpy,
      verboseSpy,
      repo,
      issue1,
    };
  }

  function createContextInner(
    repo: Context["payload"]["repository"],
    sender: Context["payload"]["sender"],
    issue: Context["payload"]["issue"],
    comment: SupportedEvents["issue_comment.created"]["payload"]["comment"] | null,
    eventName: Context["eventName"] = "issue_comment.created"
  ): Context {
    return {
      eventName: eventName,
      payload: {
        action: "created",
        sender: sender,
        repository: repo,
        issue: issue,
        ...(comment && { comment: comment }),
        installation: { id: 1 } as Context["payload"]["installation"],
        organization: { login: STRINGS.USER_1 } as Context["payload"]["organization"],
      } as Context["payload"],
      config: {
        warningThreshold: 0.75,
        matchThreshold: 0.95,
        jobMatchingThreshold: 0.95,
        redactPrivateRepoComments: false,
      },
      adapters: {} as Context["adapters"],
      logger: new Logs("debug"),
      env: {} as Env,
      octokit: octokit,
    };
  }

  function createContextIssues(
    issueBody: string = "Hello, world!",
    issueNodeId: string = "sasas",
    issueNumber: number = 1,
    issueTitle: string = "Test Issue",
    issueUser: {
      login: string;
      id: number;
    } = { login: "test", id: 1 },
    issueState: string = "open",
    issueCloseReason: string | null = null
  ) {
    const repo = db.repo.findFirst({ where: { id: { equals: 1 } } }) as unknown as Context["payload"]["repository"];
    const sender = db.users.findFirst({ where: { id: { equals: 1 } } }) as unknown as Context["payload"]["sender"];

    createIssue(issueBody, issueNodeId, issueTitle, issueNumber, issueUser, issueState, issueCloseReason, STRINGS.TEST_REPO, STRINGS.USER_1);

    const issue = db.issue.findFirst({
      where: { node_id: { equals: issueNodeId } },
    }) as unknown as Context["payload"]["issue"];

    const context = createContextInner(repo, sender, issue, null, "issues.opened");
    context.adapters = createMockAdapters(context) as unknown as Context["adapters"];

    return { context, repo, issue };
  }
});
