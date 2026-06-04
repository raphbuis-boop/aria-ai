/**
 * lib/services barrel export
 *
 * Import services from here:
 *   import { MatchingService, BriefService } from "@/lib/services"
 */

export { MatchingService } from "./matching.service";
export type { IMatchingService, MatchClient, MatchProperty, MatchResult } from "./matching.service";

export { BriefService } from "./brief.service";
export type { IBriefService, MobileClientRow, MobileTxRow } from "./brief.service";

export { AiService } from "./ai.service";
export type { IAiService } from "./ai.service";

export { MlsService } from "./mls.service";
export type { IMlsService, MlsListingPayload, SimplyRetsSinglePropertyResult } from "./mls.service";

export { NotificationService } from "./notification.service";
export type { INotificationService, InsertNotificationParams, NotificationKind } from "./notification.service";

export { EmailService } from "./email.service";
export type { IEmailService, SendEmailParams } from "./email.service";

export { SmsService } from "./sms.service";
export type { ISmsService } from "./sms.service";

export { ContactService } from "./contact.service";
export type { IContactService } from "./contact.service";

export { DealService } from "./deal.service";
export type { IDealService } from "./deal.service";

export { ConversationService } from "./conversation.service";
export type { IConversationService } from "./conversation.service";
