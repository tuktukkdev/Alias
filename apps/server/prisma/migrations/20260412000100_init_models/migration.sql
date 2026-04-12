-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "password" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_picture" (
    "user_id" INTEGER NOT NULL,
    "picture_path" VARCHAR(512) NOT NULL,
    "format" VARCHAR(32) NOT NULL,

    CONSTRAINT "user_picture_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_friends" (
    "user_id" INTEGER NOT NULL,
    "friend_id" INTEGER NOT NULL,

    CONSTRAINT "user_friends_pkey" PRIMARY KEY ("user_id","friend_id")
);

-- CreateTable
CREATE TABLE "user_friend_request" (
    "user_id_from" INTEGER NOT NULL,
    "user_id_to" INTEGER NOT NULL,

    CONSTRAINT "user_friend_request_pkey" PRIMARY KEY ("user_id_from","user_id_to")
);

-- CreateTable
CREATE TABLE "user_stats" (
    "user_id" INTEGER NOT NULL,
    "guessed" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "default_collections" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" VARCHAR(500),
    "amount_of_cards" INTEGER NOT NULL DEFAULT 0,
    "difficulty" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "default_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(64) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_tags" (
    "collection_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "collection_tags_pkey" PRIMARY KEY ("collection_id","tag_id")
);

-- CreateTable
CREATE TABLE "user_collections" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" VARCHAR(500),
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "amount_of_cards" INTEGER NOT NULL DEFAULT 0,
    "creator_id" INTEGER NOT NULL,

    CONSTRAINT "user_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_cards" (
    "id" SERIAL NOT NULL,
    "word" VARCHAR(128) NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,
    "user_collection_id" INTEGER NOT NULL,

    CONSTRAINT "user_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" SERIAL NOT NULL,
    "word" VARCHAR(128) NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards_collections" (
    "collection_id" INTEGER NOT NULL,
    "card_id" INTEGER NOT NULL,

    CONSTRAINT "cards_collections_pkey" PRIMARY KEY ("collection_id","card_id")
);

-- CreateTable
CREATE TABLE "games" (
    "game_id" SERIAL NOT NULL,
    "started_dt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_dt" TIMESTAMP(3),
    "players" TEXT NOT NULL,
    "room_owner_id" INTEGER NOT NULL,
    "score" TEXT NOT NULL,
    "winner_id" INTEGER,

    CONSTRAINT "games_pkey" PRIMARY KEY ("game_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- AddForeignKey
ALTER TABLE "user_picture" ADD CONSTRAINT "user_picture_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_friends" ADD CONSTRAINT "user_friends_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_friends" ADD CONSTRAINT "user_friends_friend_id_fkey" FOREIGN KEY ("friend_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_friend_request" ADD CONSTRAINT "user_friend_request_user_id_from_fkey" FOREIGN KEY ("user_id_from") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_friend_request" ADD CONSTRAINT "user_friend_request_user_id_to_fkey" FOREIGN KEY ("user_id_to") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_tags" ADD CONSTRAINT "collection_tags_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "default_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_tags" ADD CONSTRAINT "collection_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_collections" ADD CONSTRAINT "user_collections_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cards" ADD CONSTRAINT "user_cards_user_collection_id_fkey" FOREIGN KEY ("user_collection_id") REFERENCES "user_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards_collections" ADD CONSTRAINT "cards_collections_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "default_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards_collections" ADD CONSTRAINT "cards_collections_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_room_owner_id_fkey" FOREIGN KEY ("room_owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
