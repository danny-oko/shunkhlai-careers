DELETE FROM `applicant_file` WHERE `kind` = 'cv';--> statement-breakpoint
UPDATE `applicant_account` SET `data_json` = json_remove(`data_json`, '$.cv', '$.erp.cvHash', '$.erp.cvDirty') WHERE json_valid(`data_json`);--> statement-breakpoint
ALTER TABLE `applicant_file` DROP COLUMN `filename`;
