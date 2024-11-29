import { Context } from "../../src/types";
import { Comment } from "../../src/adapters/supabase/helpers/comment";
import { STRINGS } from "./strings";
import { jest } from "@jest/globals";

export interface CommentMock {
  id: string;
  plaintext: string | null;
  author_id: number;
  payload?: Record<string, unknown> | null;
  type?: string;
  issue_id?: string;
  embedding: number[];
}

export interface IssueMock {
  id: string;
  plaintext: string;
  author_id: number;
  payload: Record<string, unknown>;
}

export function createMockAdapters(context: Context) {
  const commentMap: Map<string, CommentMock> = new Map();
  return {
    supabase: {
      comment: {
        createComment: jest.fn(
          async (commentData: {
            markdown: string | null;
            id: string;
            author_id: number;
            payload: Record<string, unknown> | null;
            isPrivate: boolean;
            issue_id: string;
          }) => {
            if (commentMap.has(commentData.id)) {
              throw new Error("Comment already exists");
            }
            const embedding = await context.adapters.voyage.embedding.createEmbedding(commentData.markdown);
            if (commentData.isPrivate) {
              commentData.markdown = null;
            }
            commentMap.set(commentData.id, {
              id: commentData.id,
              plaintext: commentData.markdown,
              author_id: commentData.author_id,
              embedding,
              issue_id: commentData.issue_id,
            });
          }
        ),
        updateComment: jest.fn(
          async (commentData: {
            markdown: string | null;
            id: string;
            author_id: number;
            payload: Record<string, unknown> | null;
            isPrivate: boolean;
            issue_id: string;
          }) => {
            if (!commentMap.has(commentData.id)) {
              throw new Error(STRINGS.COMMENT_DOES_NOT_EXIST);
            }
            const originalComment = commentMap.get(commentData.id);
            if (!originalComment) {
              throw new Error(STRINGS.COMMENT_DOES_NOT_EXIST);
            }
            const embedding = await context.adapters.voyage.embedding.createEmbedding(commentData.markdown);
            if (commentData.isPrivate) {
              commentData.markdown = null;
            }
            commentMap.set(commentData.id, {
              id: commentData.issue_id,
              plaintext: commentData.markdown,
              author_id: commentData.author_id,
              embedding,
              payload: commentData.payload,
            });
          }
        ),
        deleteComment: jest.fn(async (commentNodeId: string) => {
          if (!commentMap.has(commentNodeId)) {
            throw new Error(STRINGS.COMMENT_DOES_NOT_EXIST);
          }
          commentMap.delete(commentNodeId);
        }),
        getComment: jest.fn(async (commentNodeId: string) => {
          if (!commentMap.has(commentNodeId)) {
            throw new Error(STRINGS.COMMENT_DOES_NOT_EXIST);
          }
          return commentMap.get(commentNodeId);
        }),
      } as unknown as Comment,
      issue: {
        getIssue: jest.fn(async (issueNodeId: string) => {
          return [
            {
              id: issueNodeId,
              plaintext: STRINGS.HELLO_WORLD,
              author_id: 1,
              payload: {},
            } as IssueMock,
          ];
        }),
      },
    },
    voyage: {
      embedding: {
        createEmbedding: jest.fn(async (text: string) => {
          if (text && text.length > 0) {
            return new Array(3072).fill(1);
          }
          return new Array(3072).fill(0);
        }),
      } as unknown as number[],
    },
  };
}
