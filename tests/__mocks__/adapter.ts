import { Context } from "../../src/types";
import { Comment } from "../../src/adapters/supabase/helpers/comment";
import { Embedding } from "../../src/adapters/openai/helpers/embedding";
import { STRINGS } from "./strings";

export interface CommentMock {
  id: string;
  plaintext: string;
  author_id: number;
  embedding: number[];
}

export function createMockAdapters(context: Context) {
  const commentMap: Map<string, CommentMock> = new Map();
  return {
    supabase: {
      comment: {
        createComment: jest.fn(async (plaintext: string, commentNodeId: string, authorId: number) => {
          if (commentMap.has(commentNodeId)) {
            throw new Error("Comment already exists");
          }
          const embedding = await context.adapters.openai.embedding.createEmbedding(plaintext);
          commentMap.set(commentNodeId, { id: commentNodeId, plaintext, author_id: authorId, embedding });
        }),
        updateComment: jest.fn(async (plaintext: string, commentNodeId: string, isPrivate: boolean) => {
          console.log(commentMap);
          if (!commentMap.has(commentNodeId)) {
            throw new Error(STRINGS.COMMENT_DOES_NOT_EXIST);
          }
          const originalComment = commentMap.get(commentNodeId);
          if (!originalComment) {
            throw new Error(STRINGS.COMMENT_DOES_NOT_EXIST);
          }
          const { id, author_id } = originalComment;
          const embedding = await context.adapters.openai.embedding.createEmbedding(plaintext);
          if (isPrivate) {
            plaintext = STRINGS.CENSORED;
          }
          commentMap.set(commentNodeId, { id, plaintext, author_id, embedding });
        }),
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
