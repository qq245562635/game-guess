-- CreateEnum
CREATE TYPE "TermKind" AS ENUM ('GENRE', 'PLATFORM', 'PERSPECTIVE');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PuzzleStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'WITHDRAWN', 'RESERVE');

-- CreateEnum
CREATE TYPE "Outcome" AS ENUM ('IN_PROGRESS', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "kind" "TermKind" NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normTitle" TEXT NOT NULL,
    "releaseYear" INTEGER NOT NULL,
    "developerId" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "answerEligible" BOOLEAN NOT NULL DEFAULT false,
    "status" "GameStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alias" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "norm" TEXT NOT NULL,

    CONSTRAINT "Alias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameTerm" (
    "gameId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,

    CONSTRAINT "GameTerm_pkey" PRIMARY KEY ("gameId","termId")
);

-- CreateTable
CREATE TABLE "Puzzle" (
    "id" TEXT NOT NULL,
    "number" INTEGER,
    "dateUtc" DATE,
    "answerGameId" TEXT NOT NULL,
    "hint1" TEXT NOT NULL,
    "hint2" TEXT NOT NULL,
    "status" "PuzzleStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Puzzle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuessSession" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "puzzleId" TEXT NOT NULL,
    "isArchive" BOOLEAN NOT NULL DEFAULT false,
    "outcome" "Outcome" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GuessSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guess" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "gameId" TEXT NOT NULL,
    "clientGuessId" TEXT NOT NULL,
    "feedback" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Guess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAudit" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "actor" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "props" JSONB NOT NULL,
    "deviceId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Term_kind_slug_key" ON "Term"("kind", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Game_slug_key" ON "Game"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Game_title_key" ON "Game"("title");

-- CreateIndex
CREATE UNIQUE INDEX "Game_normTitle_key" ON "Game"("normTitle");

-- CreateIndex
CREATE UNIQUE INDEX "Alias_norm_key" ON "Alias"("norm");

-- CreateIndex
CREATE UNIQUE INDEX "Puzzle_number_key" ON "Puzzle"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Puzzle_dateUtc_key" ON "Puzzle"("dateUtc");

-- CreateIndex
CREATE UNIQUE INDEX "GuessSession_deviceId_puzzleId_key" ON "GuessSession"("deviceId", "puzzleId");

-- CreateIndex
CREATE UNIQUE INDEX "Guess_sessionId_attemptNo_key" ON "Guess"("sessionId", "attemptNo");

-- CreateIndex
CREATE UNIQUE INDEX "Guess_sessionId_gameId_key" ON "Guess"("sessionId", "gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Guess_sessionId_clientGuessId_key" ON "Guess"("sessionId", "clientGuessId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alias" ADD CONSTRAINT "Alias_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameTerm" ADD CONSTRAINT "GameTerm_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameTerm" ADD CONSTRAINT "GameTerm_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Puzzle" ADD CONSTRAINT "Puzzle_answerGameId_fkey" FOREIGN KEY ("answerGameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuessSession" ADD CONSTRAINT "GuessSession_puzzleId_fkey" FOREIGN KEY ("puzzleId") REFERENCES "Puzzle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guess" ADD CONSTRAINT "Guess_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GuessSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
