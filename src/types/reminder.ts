export type ReminderStatus =
  | "inactive"
  | "active"
  | "dismissed"
  | "sent";

export interface Reminder {
  id: string;
  user_id: string;
  thought_id: string;
  extracted_text: string;
  scheduled_at: string; // ISO 8601 timestamptz
  lead_time: number | null;
  status: ReminderStatus;
  notification_id: string | null;
  created_at: string;
  updated_at: string;
}
