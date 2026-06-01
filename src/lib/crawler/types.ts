export type LinkInfo = {
  url: string;
  text: string;
  isInternal: boolean;
  statusCode: number | null;
  isBroken: boolean;
};

export type ImageInfo = {
  url: string;
  alt: string;
  statusCode: number | null;
  isMissing: boolean;
};

export type HeadingInfo = {
  level: number;
  text: string;
};

export type IssueInfo = {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
};

export type ExtractedPage = {
  url: string;
  depth: number;
  statusCode: number | null;
  title: string | null;
  metaDescription: string | null;
  headings: HeadingInfo[];
  wordCount: number;
  links: LinkInfo[];
  images: ImageInfo[];
  issues: IssueInfo[];
  screenshotBase64: string | null;
};

export type CrawlOptions = {
  startUrl: string;
  maxDepth: number;
  maxPages: number;
  delayMs: number;
  linkConcurrency: number;
  assetConcurrency: number;
};
