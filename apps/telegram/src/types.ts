import { Context } from "grammy";

export interface BotContext extends Context {
  collectionId?: string;
  collectionSubdomain?: string;
}

export interface ConvexCollection {
  _id: string;
  subdomain: string;
  title: string;
  description: string;
  status: "not_started" | "processing" | "complete" | "error";
  imagesCount: number;
  telegramBotToken?: string;
}

export interface ConvexSearchRequest {
  _id: string;
  collectionId: string;
  status: "pending" | "processing" | "complete" | "error";
  imagesFound: string[];
  telegramChatId?: string;
  telegramMessageId?: number;
}
