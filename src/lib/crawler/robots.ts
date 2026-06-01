import robotsParser from "robots-parser";

import { CRAWLER_USER_AGENT } from "./constants";
import { defaultHeaders } from "./utils";

export async function getRobotsParser(startUrl: string) {
  const origin = new URL(startUrl).origin;
  const robotsUrl = new URL("/robots.txt", origin).toString();

  try {
    const response = await fetch(robotsUrl, {
      headers: defaultHeaders(),
    });
    if (!response.ok) {
      return robotsParser(robotsUrl, "");
    }

    const body = await response.text();
    return robotsParser(robotsUrl, body);
  } catch {
    return robotsParser(robotsUrl, "");
  }
}

export function isAllowedByRobots(
  parser: ReturnType<typeof robotsParser>,
  url: string,
) {
  return parser.isAllowed(url, CRAWLER_USER_AGENT);
}
