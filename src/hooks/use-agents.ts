import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSDK } from "@/context/global-events";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface Agent {
  name: string;
  description?: string;
  mode: "subagent" | "primary" | "all";
  hidden?: boolean;
  color?: string;
  model?: { providerID: string; modelID: string };
}

interface AgentState {
  selectedAgent: string | null;
  setSelectedAgent: (name: string | null) => void;
}

export const useAgentStore = create<AgentState>()(
  persist(
    (set) => ({
      // Default to build agent
      selectedAgent: "build",
      setSelectedAgent: (name) => set({ selectedAgent: name }),
    }),
    {
      name: "dilag-agent-store",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/**
 * Query key factory for agents
 */
export const agentKeys = {
  all: ["agents"] as const,
  list: () => [...agentKeys.all, "list"] as const,
};

/**
 * Transform raw agent data - filter out subagents and hidden agents
 */
function transformAgentData(
  agents: Array<{
    name: string;
    description?: string;
    mode?: string;
    hidden?: boolean;
    color?: string;
    model?: { providerID: string; modelID: string };
  }>,
): Agent[] {
  return agents
    .filter((agent) => agent.mode !== "subagent" && !agent.hidden)
    .map((agent) => ({
      name: agent.name,
      description: agent.description,
      mode: (agent.mode as Agent["mode"]) || "primary",
      hidden: agent.hidden,
      color: agent.color,
      model: agent.model,
    }));
}

/**
 * Hook to fetch agent data
 */
export function useAgentData() {
  const sdk = useSDK();

  return useQuery({
    queryKey: agentKeys.list(),
    queryFn: async () => {
      const response = await sdk.app.agents();
      if (!response.data) {
        throw new Error("No agent data received");
      }
      return transformAgentData(response.data);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - agents don't change often
  });
}

/**
 * Hook that provides agent selection with data fetching
 */
export function useAgents() {
  const { data, isLoading, error, refetch } = useAgentData();
  const { selectedAgent, setSelectedAgent } = useAgentStore();

  const agents = data ?? [];

  const selectAgent = useCallback(
    (name: string) => {
      setSelectedAgent(name);
    },
    [setSelectedAgent],
  );

  const selectedAgentInfo = useMemo(() => {
    if (!selectedAgent) return null;
    return agents.find((a) => a.name === selectedAgent) ?? null;
  }, [selectedAgent, agents]);

  // Cycle to next agent
  const cycleAgent = useCallback(
    (direction: 1 | -1 = 1) => {
      if (agents.length === 0) return;
      const currentIndex = agents.findIndex((a) => a.name === selectedAgent);
      const nextIndex =
        (currentIndex + direction + agents.length) % agents.length;
      setSelectedAgent(agents[nextIndex].name);
    },
    [agents, selectedAgent, setSelectedAgent],
  );

  return {
    agents,
    selectedAgent,
    selectedAgentInfo,
    isLoading,
    error: error?.message ?? null,
    selectAgent,
    cycleAgent,
    refreshAgents: refetch,
  };
}
