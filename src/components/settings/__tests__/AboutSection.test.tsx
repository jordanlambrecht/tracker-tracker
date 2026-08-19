// src/components/settings/__tests__/AboutSection.test.tsx

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AboutSection } from "@/components/settings/AboutSection"

// ---------------------------------------------------------------------------
// Sponsor links
//
// Both destinations must be offered, both must open safely, and neither may
// pull in a third-party script/iframe/remote image — this app has to work on an
// air-gapped LAN, and a remote badge would phone home on every settings visit.
// ---------------------------------------------------------------------------

describe("AboutSection sponsor links", () => {
  it("links to GitHub Sponsors with a safe external target", () => {
    render(<AboutSection />)

    const link = screen.getByRole("link", { name: "GitHub Sponsors" })
    expect(link).toHaveAttribute("href", "https://github.com/sponsors/jordanlambrecht")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("links to Buy Me a Coffee with a safe external target", () => {
    render(<AboutSection />)

    const link = screen.getByRole("link", { name: "Buy Me a Coffee" })
    expect(link).toHaveAttribute("href", "https://buymeacoffee.com/jordyjordy")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
  })

  it("presents both destinations as plain inline text links, not buttons", () => {
    render(<AboutSection />)

    for (const name of ["GitHub Sponsors", "Buy Me a Coffee"]) {
      const link = screen.getByRole("link", { name })
      // A CTA-styled button would fail the brief: this must read as a link
      // among links, matching the Repository/Documentation/License links above it.
      expect(link.tagName).toBe("A")
      expect(link.querySelector("svg")).toBeNull()
      expect(link.className).toBe("text-accent hover:underline")
    }
  })

  it("orders GitHub Sponsors ahead of Buy Me a Coffee", () => {
    const { container } = render(<AboutSection />)

    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"))
    const sponsors = hrefs.indexOf("https://github.com/sponsors/jordanlambrecht")
    const coffee = hrefs.indexOf("https://buymeacoffee.com/jordyjordy")

    expect(sponsors).toBeGreaterThan(-1)
    expect(coffee).toBeGreaterThan(sponsors)
  })

  it("states the ask flatly, with no conditional or pleading framing", () => {
    const { container } = render(<AboutSection />)

    const sentence = container.querySelector("p")?.textContent
    expect(sentence).toBe(
      "Tracker Tracker is free and independently maintained. GitHub Sponsors for recurring support, Buy Me a Coffee for a one-off."
    )
    // Guards the tone, which is the actual requirement here: no "if you find
    // this useful", no "please consider", no urgency, no gratitude-in-advance.
    for (const beg of ["please", "consider", "if you", "help keep", "support us", "donate"]) {
      expect(sentence?.toLowerCase()).not.toContain(beg)
    }
  })

  it("embeds no third-party script, iframe, or remote image", () => {
    const { container } = render(<AboutSection />)

    expect(container.querySelector("script")).toBeNull()
    expect(container.querySelector("iframe")).toBeNull()
    expect(container.querySelector("img")).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Project metadata
//
// The tab has to earn its place independently of the sponsor line: version,
// repo, docs and licence live nowhere else in the UI except the sidebar footer,
// which collapses to zero width.
// ---------------------------------------------------------------------------

describe("AboutSection project metadata", () => {
  it("renders every external link with rel=noopener noreferrer", () => {
    const { container } = render(<AboutSection />)

    const links = Array.from(container.querySelectorAll("a"))
    expect(links.length).toBeGreaterThan(0)

    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank")
      expect(link).toHaveAttribute("rel", "noopener noreferrer")
    }
  })

  it("surfaces the repository, documentation, and licence", () => {
    render(<AboutSection />)

    expect(screen.getByRole("link", { name: "jordanlambrecht/tracker-tracker" })).toHaveAttribute(
      "href",
      "https://github.com/jordanlambrecht/tracker-tracker"
    )
    expect(
      screen.getByRole("link", { name: "jordanlambrecht.github.io/tracker-tracker" })
    ).toHaveAttribute("href", "https://jordanlambrecht.github.io/tracker-tracker")
    expect(screen.getByRole("link", { name: "GPL-3.0" })).toHaveAttribute(
      "href",
      "https://github.com/jordanlambrecht/tracker-tracker/blob/main/LICENSE"
    )
  })

  it("labels the section About", () => {
    render(<AboutSection />)

    expect(screen.getByRole("heading", { name: "About" })).toBeInTheDocument()
  })
})
