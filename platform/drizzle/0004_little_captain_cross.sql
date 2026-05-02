CREATE TABLE `contest_votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contestId` int NOT NULL,
	`candidateId` varchar(64) NOT NULL,
	`voterFingerprint` varchar(128) NOT NULL,
	`voterName` varchar(128),
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contest_votes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `naming_contests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`shareId` varchar(32) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`candidates` json NOT NULL,
	`status` enum('active','closed','archived') NOT NULL DEFAULT 'active',
	`totalVotes` int NOT NULL DEFAULT 0,
	`totalViews` int NOT NULL DEFAULT 0,
	`closesAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `naming_contests_id` PRIMARY KEY(`id`),
	CONSTRAINT `naming_contests_shareId_unique` UNIQUE(`shareId`)
);
