import type { Profile, User } from "@biawin/types";
import { apiClient } from "./api-client";

export const usersApi = {
  getCurrentUser: () => apiClient.get<User>("/users/me"),
  getCurrentProfile: () => apiClient.get<Profile>("/profiles/me"),
};
