ALTER TABLE `users` ADD `subscriptionTier` enum('explorer','founder','governance','enterprise') DEFAULT 'explorer' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `reportCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `billingPeriodStart` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeSubscriptionId` varchar(255);