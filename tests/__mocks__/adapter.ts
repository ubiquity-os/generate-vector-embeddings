import { Context } from "../../src/types";
import { Comment } from "../../src/adapters/supabase/helpers/comment";
import { Embedding } from "../../src/adapters/openai/helpers/embedding";
import { STRINGS } from "./strings";

export interface CommentMock {
  id: number;
  commentbody: string;
  issuebody: string;
  embedding: number[];
}

export function createMockAdapters(context: Context) {
  const commentMap: Map<number, CommentMock> = new Map();
  return {
    supabase: {
      comment: {
        createComment: jest.fn(async (commentBody: string, commentId: number, issueBody: string) => {
          if (commentMap.has(commentId)) {
            throw new Error("Comment already exists");
          }
          const embedding = await context.adapters.openai.embedding.createEmbedding(commentBody);
          commentMap.set(commentId, { id: commentId, commentbody: commentBody, issuebody: issueBody, embedding });
        }),
        updateComment: jest.fn(async (commentBody: string, commentId: number) => {
          if (!commentMap.has(commentId)) {
            throw new Error(STRINGS.COMMENT_DOES_NOT_EXIST);
          }
          const originalComment = commentMap.get(commentId);
          if (!originalComment) {
            throw new Error(STRINGS.COMMENT_DOES_NOT_EXIST);
          }
          const { id, issuebody } = originalComment;
          const embedding = await context.adapters.openai.embedding.createEmbedding(commentBody);
          commentMap.set(commentId, { id, commentbody: commentBody, issuebody, embedding });
        }),
        deleteComment: jest.fn(async (commentId: number) => {
          if (!commentMap.has(commentId)) {
            throw new Error(STRINGS.COMMENT_DOES_NOT_EXIST);
          }
          commentMap.delete(commentId);
        }),
        getComment: jest.fn(async (commentId: number) => {
          if (!commentMap.has(commentId)) {
            throw new Error(STRINGS.COMMENT_DOES_NOT_EXIST);
          }
          return commentMap.get(commentId);
        }),
      } as unknown as Comment,
    },
    openai: {
      embedding: {
        createEmbedding: jest.fn(async (text: string) => {
          if (text && text.length > 0) {
            return new Array(3072).fill(1);
          }
          return new Array(3072).fill(0);
        }),
      } as unknown as Embedding,
    },
  };
}
