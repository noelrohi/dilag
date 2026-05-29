import { render, screen } from "@testing-library/react"
import { SidebarProvider } from "@dilag/ui/sidebar"
import { describe, expect, it } from "vitest"
import { PageHeader, PageHeaderLeft, PageHeaderRight } from "./page-header"

function renderWithSidebar(children: React.ReactNode, defaultOpen: boolean) {
  return render(<SidebarProvider defaultOpen={defaultOpen}>{children}</SidebarProvider>)
}

describe("PageHeader", () => {
  it("reserves titlebar controls when the sidebar is collapsed", () => {
    renderWithSidebar(
      <PageHeader>
        <PageHeaderLeft>Chat title</PageHeaderLeft>
      </PageHeader>,
      false,
    )

    expect(screen.getByRole("banner")).toHaveClass(
      "pl-[var(--titlebar-page-header-collapsed-left,144px)]",
    )
  })

  it("keeps the compact left padding when the sidebar is expanded", () => {
    renderWithSidebar(
      <PageHeader>
        <PageHeaderLeft>Chat title</PageHeaderLeft>
        <PageHeaderRight>Actions</PageHeaderRight>
      </PageHeader>,
      true,
    )

    const header = screen.getByRole("banner")
    expect(header).toHaveClass("pl-3")
    expect(header).not.toHaveClass("pl-[var(--titlebar-page-header-collapsed-left,144px)]")
  })
})
