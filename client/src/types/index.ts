export type UserRole = "Admin" | "Manager" | "User";

export interface User {
  _id: string;
  uname: string;
  ugender: string;
  uemail: string;
  umobile: string;
  ustatus: UserRole;
  udate: string;
  utime: string;
  totaltc: number;
  reservedtc: number;
  pendingtc: number;
  payment: number;
  due: number;
  points: number;
}

export interface RegisterPayload {
  uname: string;
  uemail: string;
  umobile: string;
  upass: string;
  ugender: string;
}

export interface Checkpoint {
  _id: string;
  route: string;
  price: number;
}

export interface Route {
  _id: string;
  sp: string;
  fp: string;
  checkpoints: Checkpoint[];
}