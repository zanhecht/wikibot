﻿// cd ~/wikibot && time ../node/bin/node process_dump.js
// Import Wikimedia database backup dumps data to user-created database on Tool Labs.
// 應用工具: 遍歷所有 dumps data 之頁面，並將資料寫入 .csv file，進而匯入 database。
// @see https://www.mediawiki.org/wiki/Manual:Importing_XML_dumps#Using_importDump.php.2C_if_you_have_shell_access

// 2016/3/12 11:56:10	初版試營運。純粹篩選約需近 3 minutes。

// 使用新版 node.js 能加快寫入 .csv file 之速度，降低 CPU 與 RAM 使用；
// 2016/3/19 do_write_file 使用時間約需近 20 minutes，LOAD DATA 使用時間約需近 10 minutes 執行。

'use strict';

require('./wiki loder.js');
// for CeL.wiki.cache(), CeL.fs_mkdir(), CeL.wiki.read_dump()
CeL.run('application.platform.nodejs');

function process_data(error) {
	if (error)
		CeL.err(error);

	var start_read_time = Date.now(), count = 0, max_length = 0;
	CeL.wiki.read_dump(function(page_data) {
		// filter
		if (false && page_data.ns !== 0)
			return;

		var revision = page_data.revisions[0];

		if (++count % 10000 === 0)
			// e.g., "2660000: 16.546 page/ms Wikipedia:优良条目/2015年8月23日"
			CeL.log(count + ': '
					+ (count / (Date.now() - start_read_time)).toFixed(3)
					+ ' page/ms\t' + page_data.title);
		// var title = page_data.title, content = revision['*'];

		// ----------------------------
		// Check data.

		// 似乎沒 !page_data.title 這種問題。
		if (false && !page_data.title)
			CeL.warn('* No title: [[' + page_data.id + ']]');
		// [[Wikipedia:快速删除方针]]
		if (revision['*']) {
			max_length = Math.max(max_length, revision['*'].length);
			// filter patterns
			if (false && revision['*'].includes('\u200E'))
				list.push(page_data.title);
			if (/{{(?:[Nn]o)?[Bb]ot[^a-zA-Z]/.test(revision['*']))
				list.push(page_data.title);
		} else {
			CeL.warn('* No content: [[' + page_data.title + ']]');
		}

		// ----------------------------
		// Write to .csv file.

		if (do_write_file) {
			file_stream.write([ page_data.pageid, page_data.ns,
			// escape ',', '"'
			'"' + page_data.title.replace(/"/g, '""') + '"',
			// '2000-01-01T00:00:00Z' → '2000-01-01 00:00:00'
			revision.timestamp.slice(0, -1).replace('T', ' '),
			//
			'"' + revision['*'].replace(/"/g, '""') + '"' ]
			//
			.join(',') + '\n');
		}

		// ----------------------------
		// Write to database.

		if (do_realtime_import)
			connection.query({
				sql : 'INSERT INTO `page`(pageid,ns,title,timestamp,text)'
						+ ' VALUES (?, ?, ?, ?, ?);',
				values : [ page_data.pageid, page_data.ns, page_data.title,
				// '2000-01-01T00:00:00Z' → '2000-01-01 00:00:00'
				revision.timestamp.slice(0, -1).replace('T', ' '),
						revision['*'] ]
			}, function(error) {
				if (error)
					CeL.err(error);
			});
	}, {
		directory : base_directory,
		first : function(fn) {
			var filename = fn.replace(/[^.]+$/, 'csv');
			if (do_write_file === undefined)
				// auto detect
				try {
					// check if file exists
					do_write_file = !require('fs').statSync(filename);
					if (!do_write_file)
						CeL.info('process_data: The CSV file exists, '
								+ 'so I will not import data to database: ['
								+ filename + ']');
				} catch (e) {
					do_write_file = true;
				}

			if (do_write_file) {
				CeL.log('process_data: Write to [' + filename + ']');
				file_stream = new require('fs').WriteStream(filename, 'utf8');
			}
		},
		last : function() {
			// e.g., "All 2755239 pages, 167.402 s."
			CeL.log('process_data: All ' + count + ' pages, '
					+ (Date.now() - start_read_time) / 1000
					+ ' s. Max page length: ' + max_length + ' characters');

			if (do_write_file) {
				file_stream.end();

				if (!do_realtime_import) {
					setup_SQL(function(error) {
						if (error)
							CeL.err(error);

						CeL.info('process_data: Import data to database...');
						var SQL = "LOAD DATA LOCAL INFILE '" + file_stream.path
								+ LOAD_DATA_SQL;
						CeL.log(SQL.replace(/\\n/g, '\\n'));
						connection.query(SQL, function(error, rows) {
							if (error)
								CeL.err(error);
							else
								CeL.log(rows);
							endding();
						});
					});
				}
			} else
				endding();
		}
	});
}

function setup_SQL(callback) {
	CeL.info('setup_SQL: Re-creating database...');
	SQL_session = new CeL.wiki.SQL('zhwiki', function(error) {
		if (error)
			CeL.err(error);

		connection.query('DROP TABLE `page`', function(error) {
			connection.query(create_SQL, callback);
		});

	});
	connection = SQL_session.connection;
}

function endding() {
	CeL.log('endding: All '
			+ ((Date.now() - start_time) / 1000 / 60).toFixed(3) + ' minutes.');
	if (list && list.length > 0) {
		var filename = base_directory + 'filtered.lst';
		CeL.info('endding: ' + list.length + ' pages filtered, write to ['
				+ filename + '].');
		require('fs').writeFileSync(filename, list.join('\n'), 'utf8');
		// console.log(list.join('\n'));
	}
}

var start_time = Date.now(), list = [],
/** {String}base directory */
base_directory = bot_directory + 'dumps/',
/** {Boolean}write to CSV file. */
do_write_file, file_stream,
/** {Boolean}import to database */
do_realtime_import = false,
// pageid,ns,title: https://www.mediawiki.org/wiki/Manual:Page_table
// timestamp: https://www.mediawiki.org/wiki/Manual:Revision_table
// text: https://www.mediawiki.org/wiki/Manual:Text_table
create_SQL = 'CREATE TABLE page(pageid INT(10) UNSIGNED NOT NULL, ns INT(11) NOT NULL, title VARBINARY(255) NOT NULL, timestamp TIMESTAMP NOT NULL, text MEDIUMBLOB, PRIMARY KEY (pageid,title))',
//
LOAD_DATA_SQL = "' INTO TABLE `page` FIELDS TERMINATED BY ',' ENCLOSED BY '\"' LINES TERMINATED BY '\n' (pageid,ns,title,timestamp,text);",
//
SQL_session, connection;

if (do_realtime_import) {
	setup_SQL(function(error) {
		if (error)
			CeL.err(error);

		// FATAL ERROR: JS Allocation failed - process out of memory
		// Aborted
		connection.beginTransaction(process_data);
	});
} else {
	process_data();
}
