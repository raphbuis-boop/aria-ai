/**
 * EmailService — thin adapter over lib/resend.ts
 *
 * Wraps sendEmail and the two template helpers.
 * FROM address, API key handling, and error logging stay in lib/resend.ts.
 */

import {
  sendEmail,
  showingReminderEmail,
  engagementAlertEmail,
  type SendEmailParams,
} from "@/lib/resend";

export type { SendEmailParams };

export interface IEmailService {
  send(params: SendEmailParams): Promise<void>;
  templates: {
    showingReminder(opts: {
      agentName: string;
      address: string;
      clientName: string;
      showingDate: string;
      hoursAway: number;
    }): string;
    engagementAlert(opts: {
      agentName: string;
      clients: { name: string; days: number }[];
    }): string;
  };
}

export const EmailService: IEmailService = {
  send(params) {
    return sendEmail(params);
  },

  templates: {
    showingReminder(opts) {
      return showingReminderEmail(opts);
    },
    engagementAlert(opts) {
      return engagementAlertEmail(opts);
    },
  },
};
