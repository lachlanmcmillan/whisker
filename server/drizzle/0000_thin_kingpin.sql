CREATE TABLE `entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`feedId` integer NOT NULL,
	`entryId` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`published` text DEFAULT '' NOT NULL,
	`updated` text,
	`description` text DEFAULT '' NOT NULL,
	`thumbnail` text,
	`content` text,
	`openedAt` text,
	`archivedAt` text,
	`starredAt` text,
	FOREIGN KEY (`feedId`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_feedId_entryId_unique` ON `entries` (`feedId`,`entryId`);--> statement-breakpoint
CREATE TABLE `feeds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`link` text NOT NULL,
	`feedUrl` text DEFAULT '' NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`published` text DEFAULT '' NOT NULL,
	`image` text,
	`fetchedAt` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feeds_link_unique` ON `feeds` (`link`);