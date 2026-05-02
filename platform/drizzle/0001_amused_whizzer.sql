CREATE TABLE `credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`keyName` varchar(128) NOT NULL,
	`encryptedValue` text NOT NULL,
	`service` varchar(64),
	`description` text,
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `execution_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executionId` int,
	`stepId` int,
	`level` enum('debug','info','warn','error') NOT NULL DEFAULT 'info',
	`message` text NOT NULL,
	`metadata` json,
	`eventTime` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `execution_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflowId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('pending','running','completed','failed','cancelled') NOT NULL DEFAULT 'pending',
	`currentStepId` int,
	`totalSteps` int NOT NULL DEFAULT 0,
	`completedSteps` int NOT NULL DEFAULT 0,
	`results` json,
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `step_executions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`executionId` int NOT NULL,
	`stepId` int NOT NULL,
	`status` enum('pending','running','completed','failed','skipped') NOT NULL DEFAULT 'pending',
	`output` json,
	`errorMessage` text,
	`proofStatus` enum('unverified','proving','verified','failed') NOT NULL DEFAULT 'unverified',
	`proofHash` varchar(128),
	`retryCount` int NOT NULL DEFAULT 0,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `step_executions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workflowId` int NOT NULL,
	`agentId` varchar(128) NOT NULL,
	`label` varchar(255) NOT NULL,
	`description` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`position` json,
	`config` json,
	`dependencies` json,
	`proofStatus` enum('unverified','proving','verified','failed') NOT NULL DEFAULT 'unverified',
	`proofHash` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(64) NOT NULL,
	`icon` varchar(64),
	`complexity` enum('beginner','intermediate','advanced') NOT NULL DEFAULT 'intermediate',
	`definition` json,
	`tags` json,
	`cloneCount` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`version` varchar(32) NOT NULL DEFAULT '1.0',
	`status` enum('draft','active','archived') NOT NULL DEFAULT 'draft',
	`templateId` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflows_id` PRIMARY KEY(`id`)
);
