import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ArenaAgent, ArenaMission, ArenaTournament, ArenaMatch } from "../../../shared/schema";

export function useArenaAgents(rank?: string) {
  return useQuery({
    queryKey: ["arena-agents", rank],
    queryFn: async () => {
      let query = supabase
        .from("arena_agents")
        .select("*")
        .order("elo", { ascending: false });

      if (rank) {
        query = query.eq("current_rank", rank);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ArenaAgent[];
    },
  });
}

export function useArenaAgent(agentId: string) {
  return useQuery({
    queryKey: ["arena-agent", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arena_agents")
        .select("*")
        .eq("id", agentId)
        .single();
      if (error) throw error;
      return data as ArenaAgent;
    },
    enabled: !!agentId,
  });
}

export function useCreateArenaAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (agent: {
      agentName: string;
      avatarInitials: string;
      avatarColor: string;
      personality?: string[];
      isConfidential?: boolean;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("arena_agents")
        .insert({
          user_id: session.session.user.id,
          agent_name: agent.agentName,
          avatar_initials: agent.avatarInitials,
          avatar_color: agent.avatarColor,
          personality: agent.personality || [],
          is_confidential: agent.isConfidential ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ArenaAgent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arena-agents"] });
    },
  });
}

export function useArenaMissions(agentId: string) {
  return useQuery({
    queryKey: ["arena-missions", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arena_missions")
        .select("*")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ArenaMission[];
    },
    enabled: !!agentId,
  });
}

export function useActiveMissions() {
  return useQuery({
    queryKey: ["active-missions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arena_missions")
        .select("*, arena_agents(*)")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
}

export function useTournaments(status?: string) {
  return useQuery({
    queryKey: ["tournaments", status],
    queryFn: async () => {
      let query = supabase
        .from("arena_tournaments")
        .select("*")
        .order("start_date", { ascending: true });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ArenaTournament[];
    },
  });
}

export function useTournamentMatches(tournamentId: string) {
  return useQuery({
    queryKey: ["tournament-matches", tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("arena_matches")
        .select("*, arena_agents!arena_matches_agent1_id_fkey(*), arena_agents!arena_matches_agent2_id_fkey(*)")
        .eq("tournament_id", tournamentId)
        .order("round", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!tournamentId,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["arena-notifications"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return [];

      const { data, error } = await supabase
        .from("arena_notifications")
        .select("*")
        .eq("user_id", session.session.user.id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("arena_notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arena-notifications"] });
    },
  });
}

export function useLeaderboard(rank?: string, limit: number = 20) {
  return useQuery({
    queryKey: ["leaderboard", rank, limit],
    queryFn: async () => {
      let query = supabase
        .from("arena_agents")
        .select("*")
        .order("elo", { ascending: false })
        .limit(limit);

      if (rank) {
        query = query.eq("current_rank", rank);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ArenaAgent[];
    },
  });
}

export function useSponsorships() {
  return useQuery({
    queryKey: ["sponsorships"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return [];

      const { data, error } = await supabase
        .from("arena_sponsorships")
        .select("*, arena_agents(*)")
        .eq("sponsor_id", session.session.user.id)
        .eq("status", "active");

      if (error) throw error;
      return data;
    },
  });
}

export function useChallengeAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (challenge: {
      targetAgentId: string;
      title: string;
      description?: string;
      reward?: number;
    }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("arena_challenges")
        .insert({
          sponsor_id: session.session.user.id,
          target_agent_id: challenge.targetAgentId,
          title: challenge.title,
          description: challenge.description,
          reward: challenge.reward,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["arena-challenges"] });
    },
  });
}
