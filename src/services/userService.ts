import { apiClient } from "@/lib/axios";
import type {
  ApiResponse,
  CreateUserInput,
  UpdateUserInput,
  User,
} from "@/types";

/**
 * User service: a thin, typed wrapper around the `/users` endpoints.
 *
 * Each method returns the unwrapped `data` from the API envelope so
 * components work with plain `User` objects instead of response shapes.
 * Errors are already normalised to `Error` by the Axios response interceptor.
 */
export const userService = {
  /** Fetch all users. */
  async getUsers(): Promise<User[]> {
    const { data } = await apiClient.get<ApiResponse<User[]>>("/users");
    return data.data;
  },

  /** Fetch a single user by id. */
  async getUserById(id: string): Promise<User> {
    const { data } = await apiClient.get<ApiResponse<User>>(`/users/${id}`);
    return data.data;
  },

  /** Create a new user. */
  async createUser(input: CreateUserInput): Promise<User> {
    const { data } = await apiClient.post<ApiResponse<User>>("/users", input);
    return data.data;
  },

  /** Update an existing user. */
  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    const { data } = await apiClient.put<ApiResponse<User>>(
      `/users/${id}`,
      input,
    );
    return data.data;
  },

  /** Delete a user by id. */
  async deleteUser(id: string): Promise<void> {
    await apiClient.delete<ApiResponse<{ id: string }>>(`/users/${id}`);
  },
};
