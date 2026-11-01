// src/components/settings/__tests__/AboutSection.test.tsx

import { existsSync } from "node:fs"
import { join } from "node:path"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AboutSection } from "@/components/settings/AboutSection"

// ---------------------------------------------------------------------------
// Sponsor links
//
// Both destinations must be offered, both must open safely, and neither may
// pull in a third-party script/iframe/remote image, this app has to work on an
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

  it("draws the GitHub Sponsors button in code, with a decorative heart", () => {
    render(<AboutSection />)

    const link = screen.getByRole("link", { name: "GitHub Sponsors" })
    expect(link).toHaveTextContent("Sponsor")
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
    expect(link.querySelector("img")).toBeNull()
  })

  it("shows the Buy Me a Coffee button from a file in public, named by its alt text", () => {
    render(<AboutSection />)

    const link = screen.getByRole("link", { name: "Buy Me a Coffee" })
    const img = link.querySelector("img")
    expect(img).toHaveAttribute("src", "/img/sponsor/bmc-button.png")
    expect(img).toHaveAttribute("alt", "Buy Me a Coffee")
    // A typo here ships a broken image, and the alt text would still pass.
    expect(existsSync(join(process.cwd(), "public", "img", "sponsor", "bmc-button.png"))).toBe(true)
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
    expect(sentence).toBe("Tracker Tracker is free and independently maintained.")
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
    // Local images are fine. One whose src names a host is a request on every visit.
    for (const img of Array.from(container.querySelectorAll("img"))) {
      expect(img.getAttribute("src")).toMatch(/^\/(?!\/)/)
    }
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
