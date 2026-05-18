import { createHashHistory, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

const isPackagedFileRenderer = typeof window !== "undefined" && window.location.protocol === "file:"

export const router = createRouter({
  routeTree,
  history: isPackagedFileRenderer ? createHashHistory() : undefined,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}
