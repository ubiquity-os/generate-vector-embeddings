import { Context } from "../../src/types";
import { Comment } from "../../src/adapters/supabase/helpers/comment";
import { Embedding } from "../../src/adapters/openai/helpers/embedding";
import { STRINGS } from "./strings";

export interface CommentMock {
  id: number;
  body: string;
  embedding: number[];
}

export function createMockAdapters(context: Context) {
  const commentMap: Map<number, CommentMock> = new Map();
  return {
    supabase: {
      comment: {
        createComment: jest.fn(async (commentBody: string, commentId: number) => {
          if (commentMap.has(commentId)) {
            throw new Error("Comment already exists");
          }
          const embedding = await context.adapters.openai.embedding.createEmbedding(commentBody);
          commentMap.set(commentId, { id: commentId, body: commentBody, embedding });
        }),
        updateComment: jest.fn(async (commentBody: string, commentId: number) => {
          if (!commentMap.has(commentId)) {
            throw new Error(STRINGS.COMMENT_DOES_NOT_EXIST);
          }
          const embedding = await context.adapters.openai.embedding.createEmbedding(commentBody);
          commentMap.set(commentId, { id: commentId, body: commentBody, embedding });
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
            return new Array(512).fill(1);
          }
          return new Array(512).fill(0);
        }),
      } as unknown as Embedding,
    },
  };
}
