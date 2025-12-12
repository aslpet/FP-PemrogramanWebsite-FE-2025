import api from "../axios";

export interface SubmitScoreData {
  player_name: string;
  score: number;
  max_score: number;
  time_taken: number;
  accuracy: number;
}

export interface LeaderboardEntry {
  id: string;
  player_name: string;
  score: number;
  max_score: number;
  time_taken: number;
  accuracy: number;
  created_at: string;
  user: {
    id: string;
    username: string;
    profile_picture: string | null;
  } | null;
}

export interface SubmitScoreResponse {
  id: string;
  updated: boolean;
  message: string;
}

export const submitScore = async (
  gameId: string,
  data: SubmitScoreData,
): Promise<SubmitScoreResponse> => {
  const response = await api.post(
    `/api/game/game-type/spell-the-word/${gameId}/submit-score`,
    data,
  );
  return response.data.data;
};

export const getLeaderboard = async (
  gameId: string,
  limit = 10,
): Promise<LeaderboardEntry[]> => {
  const response = await api.get(
    `/api/game/game-type/spell-the-word/${gameId}/leaderboard`,
    {
      params: { limit },
    },
  );
  return response.data.data;
};
