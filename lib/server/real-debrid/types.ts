export type RealDebridTorrentStatus =
  | "magnet_error"
  | "magnet_conversion"
  | "waiting_files_selection"
  | "queued"
  | "downloading"
  | "downloaded"
  | "error"
  | "virus"
  | "compressing"
  | "uploading"
  | "dead";

export type RealDebridTorrent = {
  id: string;
  filename: string;
  hash: string;
  bytes: number;
  host: string;
  split: number;
  progress: number;
  status: RealDebridTorrentStatus;
  added: string;
  links?: string[];
};

export type AddMagnetResponse = {
  id: string;
  uri: string;
};

export type UnrestrictLinkResponse = {
  id: string;
  filename: string;
  filesize: number;
  link: string;
  download: string;
  host: string;
};

export type RealDebridUser = {
  id: number;
  username: string;
  email: string;
  points: number;
  locale: string;
  avatar: string;
  type: string;
  premium: number;
  expiration: string;
};

export type RealDebridDownload = {
  id: string;
  filename: string;
  mimeType: string;
  filesize: number;
  link: string;
  host: string;
  chunks: number;
  download: string;
  generated: string;
};

export type RealDebridErrorPayload = {
  error?: string;
  error_code?: number;
};

export type RealDebridDeviceCodeResponse = {
  device_code: string;
  user_code: string;
  interval: number;
  expires_in: number;
  verification_url: string;
};

export type RealDebridTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: "Bearer";
  refresh_token: string;
};
