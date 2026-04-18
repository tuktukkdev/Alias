// сервис для работы с друзьями и заявками
import { prisma } from "../db/prisma";

export interface FriendEntry {
  id: number;
  username: string;
}

export interface FriendsData {
  friends: FriendEntry[];
  pending: FriendEntry[];   // входящие заявки
  sent: FriendEntry[];      // отправленные заявки
}

// получаем списки друзей и заявок (три запроса параллельно)
export async function getFriendsData(userId: number): Promise<FriendsData> {
  const [friendRows, pendingRows, sentRows] = await Promise.all([
    prisma.userFriend.findMany({
      where: { userId },
      include: { friend: { select: { id: true, username: true } } },
    }),
    prisma.userFriendRequest.findMany({
      where: { userIdTo: userId },
      include: { fromUser: { select: { id: true, username: true } } },
    }),
    prisma.userFriendRequest.findMany({
      where: { userIdFrom: userId },
      include: { toUser: { select: { id: true, username: true } } },
    }),
  ]);

  return {
    friends: friendRows.map((r) => ({ id: r.friend.id, username: r.friend.username })),
    pending: pendingRows.map((r) => ({ id: r.fromUser.id, username: r.fromUser.username })),
    sent: sentRows.map((r) => ({ id: r.toUser.id, username: r.toUser.username })),
  };
}

export type SendRequestResult =
  | { ok: true }
  | { ok: false; code: "USER_NOT_FOUND" | "ALREADY_FRIENDS" | "REQUEST_EXISTS" | "SELF" };

// отправляем заявку в друзья (если встречная — автопринятие)
export async function sendFriendRequest(
  fromId: number,
  toUsername: string,
): Promise<SendRequestResult> {
  if (!toUsername.trim()) return { ok: false, code: "USER_NOT_FOUND" };

  const target = await prisma.user.findUnique({ where: { username: toUsername } });
  if (!target) return { ok: false, code: "USER_NOT_FOUND" };
  if (target.id === fromId) return { ok: false, code: "SELF" };

  const alreadyFriend = await prisma.userFriend.findUnique({
    where: { userId_friendId: { userId: fromId, friendId: target.id } },
  });
  if (alreadyFriend) return { ok: false, code: "ALREADY_FRIENDS" };

  const existingRequest = await prisma.userFriendRequest.findUnique({
    where: { userIdFrom_userIdTo: { userIdFrom: fromId, userIdTo: target.id } },
  });
  if (existingRequest) return { ok: false, code: "REQUEST_EXISTS" };

  // если тот уже отправил нам заявку — принимаем автоматом
  const reverseRequest = await prisma.userFriendRequest.findUnique({
    where: { userIdFrom_userIdTo: { userIdFrom: target.id, userIdTo: fromId } },
  });

  if (reverseRequest) {
    await prisma.$transaction([
      prisma.userFriendRequest.delete({
        where: { userIdFrom_userIdTo: { userIdFrom: target.id, userIdTo: fromId } },
      }),
      prisma.userFriend.create({ data: { userId: fromId, friendId: target.id } }),
      prisma.userFriend.create({ data: { userId: target.id, friendId: fromId } }),
    ]);
    return { ok: true };
  }

  await prisma.userFriendRequest.create({
    data: { userIdFrom: fromId, userIdTo: target.id },
  });
  return { ok: true };
}

export type AcceptRequestResult =
  | { ok: true }
  | { ok: false; code: "REQUEST_NOT_FOUND" };

// принимаем заявку в друзья (транзакция)
export async function acceptFriendRequest(
  userId: number,
  fromId: number,
): Promise<AcceptRequestResult> {
  const request = await prisma.userFriendRequest.findUnique({
    where: { userIdFrom_userIdTo: { userIdFrom: fromId, userIdTo: userId } },
  });
  if (!request) return { ok: false, code: "REQUEST_NOT_FOUND" };

  await prisma.$transaction([
    prisma.userFriendRequest.delete({
      where: { userIdFrom_userIdTo: { userIdFrom: fromId, userIdTo: userId } },
    }),
    prisma.userFriend.create({ data: { userId, friendId: fromId } }),
    prisma.userFriend.create({ data: { userId: fromId, friendId: userId } }),
  ]);
  return { ok: true };
}

export type DeclineRequestResult =
  | { ok: true }
  | { ok: false; code: "REQUEST_NOT_FOUND" };

// отклоняем входящую заявку
export async function declineFriendRequest(
  userId: number,
  fromId: number,
): Promise<DeclineRequestResult> {
  const request = await prisma.userFriendRequest.findUnique({
    where: { userIdFrom_userIdTo: { userIdFrom: fromId, userIdTo: userId } },
  });
  if (!request) return { ok: false, code: "REQUEST_NOT_FOUND" };

  await prisma.userFriendRequest.delete({
    where: { userIdFrom_userIdTo: { userIdFrom: fromId, userIdTo: userId } },
  });
  return { ok: true };
}

// отменяем свою отправленную заявку
export async function cancelFriendRequest(
  userId: number,
  toId: number,
): Promise<{ ok: true } | { ok: false; code: "REQUEST_NOT_FOUND" }> {
  const request = await prisma.userFriendRequest.findUnique({
    where: { userIdFrom_userIdTo: { userIdFrom: userId, userIdTo: toId } },
  });
  if (!request) return { ok: false, code: "REQUEST_NOT_FOUND" };

  await prisma.userFriendRequest.delete({
    where: { userIdFrom_userIdTo: { userIdFrom: userId, userIdTo: toId } },
  });
  return { ok: true };
}

// удаляем из друзей (обоюдно)
export async function removeFriend(
  userId: number,
  friendId: number,
): Promise<{ ok: true } | { ok: false; code: "NOT_FRIENDS" }> {
  const existing = await prisma.userFriend.findUnique({
    where: { userId_friendId: { userId, friendId } },
  });
  if (!existing) return { ok: false, code: "NOT_FRIENDS" };

  await prisma.$transaction([
    prisma.userFriend.deleteMany({ where: { userId, friendId } }),
    prisma.userFriend.deleteMany({ where: { userId: friendId, friendId: userId } }),
  ]);
  return { ok: true };
}

// считаем количество входящих заявок
export async function getPendingCount(userId: number): Promise<number> {
  return prisma.userFriendRequest.count({ where: { userIdTo: userId } });
}
