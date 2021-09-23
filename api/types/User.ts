export interface UserEntity {
  id?: string;
  email?: string;
  password?: string;
  hk?: string;
  sk?: string;
  sk2?: string;
}

export type UserPublic = Pick<UserEntity, "email" | "id">
