// src/components/settings/__tests__/SettingsSectionHeading.test.tsx
//
// Every settings section is found by its heading: the region takes the heading
// as its name, and the credential vault link scrolls to the heading's id.

import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  SettingsSectionHeading,
  settingsHeadingId,
} from "@/components/settings/SettingsSectionHeading"

function Section(props: Parameters<typeof SettingsSectionHeading>[0]) {
  return (
    <section aria-labelledby={settingsHeadingId(props.id)}>
      <SettingsSectionHeading {...props} />
    </section>
  )
}

describe("SettingsSectionHeading", () => {
  it("names its section, and links the docs from its tooltip", () => {
    render(
      <Section
        id="tag-groups"
        title="Tag Groups"
        tooltip="Group client tags."
        docs={{ href: "https://example.test/tag-groups/" }}
      />
    )

    const region = screen.getByRole("region", { name: "Tag Groups" })
    expect(within(region).getByRole("heading", { name: "Tag Groups" })).toHaveAttribute(
      "id",
      "tag-groups-heading"
    )
    expect(
      within(region).getByRole("button", { name: "More info, opens documentation" })
    ).toBeInTheDocument()
  })

  // SettingsSection's gap under its title is this class.
  it("keeps the spacing on a title that stands alone", () => {
    render(<Section id="proxy" title="Proxy" className="mb-4" />)

    expect(screen.getByRole("heading", { name: "Proxy" })).toHaveClass("mb-4")
  })

  it("keeps the action and the description out of the section's name", () => {
    render(
      <Section
        id="tag-groups"
        title="Tag Groups"
        description="Bundle client tags into named groups."
        action={<button type="button">+ New Group</button>}
      />
    )

    const region = screen.getByRole("region", { name: "Tag Groups" })
    expect(within(region).getByRole("button", { name: "+ New Group" })).toBeInTheDocument()
    expect(within(region).getByText("Bundle client tags into named groups.")).toBeInTheDocument()
  })
})
