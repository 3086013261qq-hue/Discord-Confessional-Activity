export type Verdict = 'heaven' | 'hell';
export type Rarity = 'R' | 'SR' | 'SSR';
export interface Card {
  id: string;
  character: string;
  alignment: string;
  rarity: Rarity;
  name: string;
  effect_key: string;
  animation_key?: string;
}
export interface Action {
  kind: 'nickname' | 'state' | 'token';
  value: string;
  hours: number;
}
export interface Detail {
  quote: string;
  description: string;
  actions: Action[];
  interaction?: string;
}
export interface PublicJudgment {
  id: string;
  verdict: Verdict;
  character: string;
  rarity: Rarity;
  animation_key: string;
  sequence: string[];
  selected_index: number | null;
  revealed_at: number | null;
  created_at: number;
  execution_status: string;
  interaction: Record<string, any>;
  card?: Card;
  detail?: Detail;
  art_urls?: string[];
  report?: string[];
  rerolled: number;
}
export interface Snapshot {
  role: 'nun' | 'confessor' | 'spectator' | 'identity_select';
  can_nun?: boolean;
  ai_enabled?: boolean;
  sessions: { id: string; anonymous_id: string; status: string }[];
  session?: {
    id: string;
    anonymous_id: string;
    status: string;
    kind?: string;
    mode?: string;
    reply_mode?: string;
    mode_deadline?: number;
    poll_id?: string;
    poll_url?: string;
    disconnected?: boolean;
  };
  messages: {
    id: string;
    sender_type: string;
    type: string;
    content: string;
    created_at: number;
  }[];
  judgment?: PublicJudgment;
  tokens: string[];
  notices: string[];
}
