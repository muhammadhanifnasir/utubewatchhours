import type { Page } from "playwright";

import type { HeadingInfo } from "./types";

type RawPageData = {
  title: string | null;
  metaDescription: string | null;
  headings: HeadingInfo[];
  wordCount: number;
  links: { href: string; text: string }[];
  images: { src: string; alt: string }[];
  lang: string | null;
};

export async function extractPageData(page: Page): Promise<RawPageData> {
  return page.evaluate(() => {
    const title = document.title?.trim() || null;
    const metaDescription = document
      .querySelector('meta[name="description"]')
      ?.getAttribute("content")
      ?.trim();

    const headings = Array.from(
      document.querySelectorAll<HTMLHeadingElement>(
        "h1, h2, h3, h4, h5, h6",
      ),
    )
      .map((heading) => ({
        level: Number(heading.tagName.replace("H", "")),
        text: heading.textContent?.trim() ?? "",
      }))
      .filter((heading) => heading.text.length > 0);

    const bodyText = document.body?.innerText ?? "";
    const wordCount = bodyText
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean).length;

    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a"))
      .map((anchor) => ({
        href: anchor.getAttribute("href") ?? "",
        text: anchor.textContent?.trim() ?? "",
      }))
      .filter((link) => link.href.length > 0);

    const images = Array.from(document.images).map((image) => ({
      src: image.getAttribute("src") ?? "",
      alt: image.getAttribute("alt") ?? "",
    }));

    return {
      title,
      metaDescription: metaDescription || null,
      headings,
      wordCount,
      links,
      images,
      lang: document.documentElement.lang || null,
    };
  });
}
