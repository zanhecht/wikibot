﻿/*

node 20201008.fix_anchor.js use_language=ja check_page=JR東日本209系電車
node 20201008.fix_anchor.js use_language=ja "check_page=クイーン (バンド)"
node 20201008.fix_anchor.js use_language=ja "check_page=醒井宿" "check_talk_page=醒井宿"
// 檢查連結到 backlink_of 頁面的 check_page 連結。例如先前已將 check_page 改名為 backlink_of 頁面的情況，欲檢查連結至 backlink_of 之頁面的 talk page 的錯誤 check_page 報告。
node 20201008.fix_anchor.js use_language=ja "check_page=ビルボード" "backlink_of=Billboard JAPAN"
node 20201008.fix_anchor.js use_project=zhmoegirl "check_page=ARGONAVIS from BanG Dream! 翻唱曲列表"


node 20201008.fix_anchor.js use_language=en
node 20201008.fix_anchor.js use_language=zh
node 20201008.fix_anchor.js use_language=ja
node 20201008.fix_anchor.js use_language=simple
node 20201008.fix_anchor.js use_project=zhmoegirl

fix archived:
node 20201008.fix_anchor.js use_language=en archives
node 20201008.fix_anchor.js use_language=zh archives
node 20201008.fix_anchor.js use_language=ja archives



jstop cron-tools.cewbot-20201008.fix_anchor.en
jstop cron-tools.cewbot-20201008.fix_anchor.zh
jstop cron-tools.cewbot-20201008.fix_anchor.ja

/usr/bin/jstart -N cron-tools.cewbot-20201008.fix_anchor.en -mem 6g -once -quiet /shared/bin/node /data/project/cewbot/wikibot/routine/20201008.fix_anchor.js use_language=en
/usr/bin/jstart -N cron-tools.cewbot-20201008.fix_anchor.zh -mem 6g -once -quiet /shared/bin/node /data/project/cewbot/wikibot/routine/20201008.fix_anchor.js use_language=zh
/usr/bin/jstart -N cron-tools.cewbot-20201008.fix_anchor.ja -mem 6g -once -quiet /shared/bin/node /data/project/cewbot/wikibot/routine/20201008.fix_anchor.js use_language=ja



2020/10/9 19:0:26	初版試營運
2020/11/17 6:48:13	仮運用を行って。ウィキペディア日本語版における試験運転。

# Listen to edits modifying section title in ARTICLE.
# Checking all pages linking to the ARTICLE.
# If there are links with old anchor, modify it to the newer one.
# If need, the bot will search revisions to find previous renamed section title.
# The bot also notify broken anchors in the talk page via {{tl|Broken anchors}}.

TODO:
因為有延遲，可檢查當前版本是否為最新版本。
fix [[Special:PermanentLink]]

檢核頁面分割、剪貼移動的情況。
假如是 level 3 之後的 section title，可 link 至上一層？

read {{cbignore}}?

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run(['application.net.wiki.template_functions',
	// for CeL.assert()
	'application.debug.log']);

// Set default language. 改變預設之語言。 e.g., 'zh'
//set_language('zh');
/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// @see {{Broken anchors|links=}}
const LINKS_PARAMETER = 'links';

// Ignore these tags
const ignore_tags = [
	//'mw-reverted',
	'mw-blank',
];

// ----------------------------------------------

// 讀入手動設定 manual settings。
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	//console.log(wiki);

	// ----------------------------------------------------

	let { general } = latest_task_configuration;
	if (!general) {
		CeL.error(`{adapt_configuration.name}: No general configuration got!`);
		general = latest_task_configuration.general = Object.create(null);
	}

	general.archive_template_list = (general.archive_template_list || ['Template:Archive'])
		// remove "Template:" prefix
		.map(name => wiki.remove_namespace(name));
	//"User:ClueBot III/ArchiveThis", "User:MiszaBot/config",
	//[[Category:有存档的讨论页]]
	//console.log(wiki.latest_task_configuration.general.archive_template_list);

	if (general.action_for_blank_talk_page) {
		// For 萌娘百科
		general.action_for_blank_talk_page = general.action_for_blank_talk_page.toString().replace(/({{)tl[a-z]?\s*\|/, '$1');
	}

	await wiki.register_redirects(['Section link', 'Broken anchors'].append(CeL.wiki.parse.anchor.essential_templates), {
		namespace: 'Template'
	});
	console.trace(wiki.latest_task_configuration.general);
}

// ----------------------------------------------------------------------------

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	//console.trace(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

function progress_to_percent(progress, add_brackets) {
	if (0 < progress && progress < 1) {
		const percent = `${(1000 * progress | 0) / 10}%`;
		return add_brackets ? ` (${percent})` : percent;
	}
	return '';
}

async function main_process() {

	if (false) {
		// for debug only
		const revision = await wiki.tracking_revisions('安定门 (北京)', '拆除安定门前');
		console.trace(revision);
		return;

		// [[w:zh:Special:Diff/37559912]]
		await check_page('香港特別行政區區旗', { force_check: true });

		await check_page('Wikipedia:互助客栈/技术‎‎', { force_check: true, namespace: '*', has_subpage_archives: true });
		await check_page('Wikipedia:当前的破坏‎‎', { force_check: true, namespace: '*', has_subpage_archives: true });

		// "&amp;"
		await check_page('三井E&Sホールディングス', { force_check: true });
		// 檢核/去除重複或無效的 anchor 網頁錨點。
		// 同じ名前の節 duplicated section title [[w:en:Special:Diff/997653871]]
		await check_page('桜木町駅', { force_check: true });
	}

	// CeL.env.arg_hash.check_page: check anchors located in what page
	if (CeL.env.arg_hash.check_page) {
		await check_page(CeL.env.arg_hash.check_page, {
			force_check: true,
			// .recheck_talk_page 不論有無修正 anchors，皆強制檢查 talk page。
			force_check_talk_page: 'check_talk_page' in CeL.env.arg_hash ? CeL.env.arg_hash.check_talk_page : true,
			// 檢查連結到 backlink_of 頁面的 check_page 連結。例如先前已將 check_page 改名為 backlink_of 頁面的情況，欲檢查連結至 backlink_of 之頁面的 talk page 的錯誤 check_page 報告。這會檢查並刪除已不存在的 check_page 連結報告。
			backlink_of: CeL.env.arg_hash.backlink_of,
			print_anchors: true,
		});
		return;
	}

	// fix archived: +"archives" argument
	if (CeL.env.arg_hash.archives) {
		const page_list_with_archives = [];
		for (let template_name of wiki.latest_task_configuration.general.archive_template_list) {
			page_list_with_archives
				.append((await wiki.embeddedin('Template:' + template_name))
					.filter(page_data => !/\/(Sandbox|沙盒|Archives?|存檔|存档)( ?\d+)?$/.test(page_data.title)
						&& !/\/(Archives?|存檔|存档|記錄|log)\//.test(page_data.title)));
		}
		//console.trace(page_list_with_archives);
		const length = page_list_with_archives.length;
		while (page_list_with_archives.length > 0) {
			const page_data = page_list_with_archives.shift();
			const NO = length - page_list_with_archives.length;
			process.title = `${NO}/${length}${progress_to_percent(NO / length, true)} ${page_data.title}`;
			try {
				await check_page(page_data, { is_archive: true, force_check: true, namespace: '*', progress: NO / length });
			} catch (e) {
				CeL.error(`Error process ${page_data.title}`);
				console.error(e);
			}
		}
		return;
	}

	wiki.listen(for_each_row, {
		// 檢查的延遲時間。
		// 時間必須長到機器人存檔作業完成後，因此最起碼應該有1分鐘。
		delay: '2m',
		//start: '30D',
		filter: filter_row,
		// also get diff
		with_diff: { LCS: true, line: true },
		// Only check edits in these namespaces. 只檢查這些命名空間中壞掉的文章 anchor 網頁錨點。
		//namespace: 0,
		parameters: {
			// 跳過機器人所做的編輯。
			// You need the "patrol" or "patrolmarks" right to request the
			// patrolled flag.
			// rcshow : '!bot',
			// 擷取資料的時候要加上filter_row()需要的資料，例如編輯摘要。
			rcprop: 'title|ids|sizes|flags|user|tags'
		},
		interval: '5s',
	});

	routine_task_done('1d');
}

function filter_row(row) {
	//console.trace(row);

	// There are too many vandalism by IP users...
	// [[w:en:User talk:Kanashimi#Bot is now erroneously changing links and anchors]]
	if (CeL.is_IP(row.user)) {
		return;
	}

	// 處理有存檔的頁面。
	if (get_sections_moved_to(row, { check_has_subpage_archives_only: true })) {
		// RFDのBotはTemplate:RFD noticeを操作するBotとTemplate:RFDを操作するBotが別体で、通常連続稼働させていますが数分間のタイムラグが生じます。「Wikipedia:リダイレクトの削除依頼/受付#RFD」は触れぬようお願いいたします。
		return !row.title.startsWith('Wikipedia:リダイレクトの削除依頼/受付');
	}

	// 僅處理 articles。
	return wiki.is_namespace(row, 0);

	// [[Wikipedia:優良條目評選/提名區]]
	// [[Wikipedia:優良條目重審/提名區]]
	// [[Wikipedia:優良條目候選/提名區]]
	// [[Wikipedia:典范条目评选/提名区]]
	// [[User:Cewbot/log/20150916]]
	if (/提名區|提名区|\/log\//.test(row.title)
		// [[Wikipedia:新条目推荐/候选]]
		|| /(\/Sandbox|\/沙盒|\/候选)$/.test(row.title)) {
		return;
	}

	//console.log([wiki.is_namespace(row, 'Draft'), wiki.is_namespace(row, 'User talk')]);
	if (wiki.is_namespace(row, 'Draft')
		//|| wiki.is_namespace(row, 'User talk')
	) {
		// ignore all link to [[Draft:]], [[User talk:]]
		return;
	}

	if (ignore_tags.some(function (tag) {
		return row.tags.includes(tag);
	})) {
		// Ignore these tags
		return;
	}

	//CeL.info(`${filter_row.name}: ${row.title}`);
	return true;
}

async function is_bad_edit(page_data) {
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 =
	 * CeL.wiki.revision_content(revision)
	 */
	const content = CeL.wiki.content_of(page_data, 0);
	if (!content || content.length < 100) {
		//console.trace(`ページの白紙化 or rediects? (${content.length}) ` + JSON.stringify(content).slice(0, 200));
		return true;
	}
}

async function get_sections_moved_to(page_data, options) {
	page_data = await wiki.page(page_data);
	/** {Array} parsed page content 頁面解析後的結構。 */
	const parsed = CeL.wiki.parser(page_data, wiki.append_session_to_options()).parse();
	// console.log(parsed);
	/**
	 * {String}page content, maybe undefined. 條目/頁面內容 =
	 * CeL.wiki.revision_content(revision)
	 */
	const content = CeL.wiki.content_of(page_data, 0);
	CeL.assert([content, parsed.toString()], 'wikitext parser check for ' + CeL.wiki.title_link_of(page_data));

	let { has_subpage_archives } = options;
	if (!has_subpage_archives) {
		// check {{Archives}}, {{Archive box}}, {{Easy Archive}}
		parsed.each('template', template_token => {
			if (wiki.latest_task_configuration.general.archive_template_list.includes(template_token.name)) {
				has_subpage_archives = true;
			}
		});
	}

	if (!has_subpage_archives)
		return;

	if (options?.check_has_subpage_archives_only)
		return true;

	CeL.info(`${get_sections_moved_to.name}: Pages with archives: ${CeL.wiki.title_link_of(page_data)}`);

	const subpage_list = await wiki.prefixsearch(page_data.title + '/');
	//console.trace(subpage_list);
	await wiki.for_each_page(subpage_list, async subpage_data => {
		await tracking_section_title_history(subpage_data, { ...options, set_recent_section_only: true, move_to_page_title: subpage_data.title });
	});
}

async function for_each_row(row) {
	if (await is_bad_edit(row)) {
		return;
	}

	//CeL.info(`${for_each_row.name}: ${CeL.wiki.title_link_of(row.title)}`);
	const diff_list = row.diff;
	const removed_section_titles = [], added_section_titles = [];
	diff_list.forEach(diff => {
		//const [removed_text, added_text] = diff;
		// all_converted: 避免遺漏。 e.g., [[w:en:Special:Diff/812844088]]
		removed_section_titles.append(CeL.wiki.parse.anchor(diff[0], wiki.append_session_to_options()));
		added_section_titles.append(CeL.wiki.parse.anchor(diff[1], wiki.append_session_to_options()));
	});

	if (removed_section_titles.length > 3) {
		if (wiki.is_namespace(row, 'User talk') || wiki.is_namespace(row, 'Wikipedia talk')) {
			// 去除剪貼移動式 archive 的情況。
			CeL.info(`${for_each_row.name}: It seems ${CeL.wiki.title_link_of(row.title + '#' + removed_section_titles[0])} is just archived?`);
			return;
		}
	}

	if (removed_section_titles.length > 0) {
		CeL.info(`${for_each_row.name}: ${CeL.wiki.title_link_of(row.title + '#' + removed_section_titles[0])
			}${removed_section_titles.length > 1 ? ` and other ${removed_section_titles.length - 1} section title(s) (#${removed_section_titles.slice(1).join(', #')})` : ''
			} is ${removed_section_titles.length === 1 && added_section_titles.length === 1 ? `renamed to ${JSON.stringify('#' + added_section_titles[0])}` : 'removed'
			} by ${CeL.wiki.title_link_of('User:' + row.revisions[0].user)} at ${row.revisions[0].timestamp}.`);

		try {
			//console.trace(row.revisions[0].slots);
			const pages_modified = await check_page(row, { removed_section_titles, added_section_titles });
			// pages_modified maybe undefined
			CeL.info(`${for_each_row.name}: ${CeL.wiki.title_link_of(row.title)}: ${pages_modified > 0 ? pages_modified : 'No'} page(s) modified.`);
			if (pages_modified > 0) {
				CeL.error(`${for_each_row.name}: Modify ${pages_modified} page(s) linking to ${CeL.wiki.title_link_of(row.title)}`);
			}
		} catch (e) {
			console.error(e);
		}
		CeL.log('-'.repeat(60));
	}
}

// ----------------------------------------------------------------------------

const KEY_latest_page_data = Symbol('latest page_data');
const KEY_got_full_revisions = Symbol('got full revisions');
const KEY_lower_cased_section_titles = Symbol('lower cased section titles');
const MARK_case_change = 'case change';

function reduce_section_title(section_title) {
	// ＝: e.g., パリからポン＝タヴァン
	return section_title.replace(/[\s_\-–()#＝]/g, '').replace(/（/g, '(').replace(/）/g, ')').toLowerCase();
}

function get_section_title_data(section_title_history, section_title) {
	if (section_title in section_title_history)
		return section_title_history[section_title];

	// get possible section name variants: lowercased
	const reduced_section = reduce_section_title(section_title), original_section_title = section_title_history[KEY_lower_cased_section_titles][reduced_section];
	if (original_section_title) {
		return {
			title: reduced_section,
			rename_to: section_title_history[original_section_title].rename_to || original_section_title,
			variant_of: [[MARK_case_change, original_section_title]],
		};
	}

	// TODO: get possible section name variants: 以文字相似程度猜測
}

function set_section_title(section_title_history, section_title, data, options) {
	if (section_title_history[section_title]?.is_present) {
		// Do not overwrite existed present section titles. 先到先得。
		return section_title_history[section_title];
	}

	section_title_history[section_title] = data;
	if (options?.move_to_page_title) {
		delete data.is_present;
		data.move_to_page_title = options.move_to_page_title;
	}

	const reduced_section = reduce_section_title(section_title);
	if (reduced_section !== section_title && !(reduced_section in section_title_history)) {
		//assert: (section_title in section_title_history)
		if (!(reduced_section in section_title_history[KEY_lower_cased_section_titles]) || data.is_present)
			section_title_history[KEY_lower_cased_section_titles][reduced_section] = section_title;
	}

	return data;
}

// 偵測繁簡轉換 字詞轉換 section_title
function mark_language_variants(recent_section_title_list, section_title_history, revision) {
	function mark_list(converted_list) {
		const language_variant = this;
		//console.trace(variant + ': ' + converted_list);
		recent_section_title_list.forEach((section_title, index) => {
			const converted = converted_list[index];
			if (section_title === converted)
				return;
			let record = section_title_history[converted];
			if (!record) {
				record = set_section_title(section_title_history, converted, {
					title: converted,
				});
			}
			if (!record.is_present) {
				if (record.rename_to && record.rename_to !== section_title) {
					CeL.error(`${mark_language_variants.name}: rename_to: ${record.rename_to}→${section_title}`);
				}
				record.rename_to = section_title;
			}
			CeL.debug(`${mark_language_variants.name}: ${converted}→${section_title}`);
			if (!record.variant_of)
				record.variant_of = [];
			record.variant_of.push([language_variant, section_title]);
		});
		//console.log(section_title_history);
	}

	for (const language_variant of ['zh-hant', 'zh-hans']) {
		//await
		wiki.convert_Chinese(recent_section_title_list, language_variant).then(mark_list.bind(language_variant));
	}
}

// get section title history
async function tracking_section_title_history(page_data, options) {
	options = CeL.setup_options(options);
	//section_title_history[section_title]={appear:{revid:0},disappear:{revid:0},rename_to:''}
	const section_title_history = options.section_title_history || {
		// 所有頁面必然皆有的 default anchors [[w:en:Help:Link#Table row linking]]
		top: { is_present: true },
		toc: { is_present: true },
		[KEY_lower_cased_section_titles]: Object.create(null),
	};

	function set_recent_section_title(wikitext, revision) {
		const anchor_list = CeL.wiki.parse.anchor(wikitext, wiki.append_session_to_options(options));
		mark_language_variants(anchor_list, section_title_history, revision);
		anchor_list.forEach(section_title =>
			set_section_title(section_title_history, section_title, {
				title: section_title,
				// is present section title
				is_present: revision || true,
				appear: null,
			}, options)
		);
		section_title_history[KEY_latest_page_data] = page_data;
	}

	if (options.set_recent_section_only) {
		page_data = await wiki.page(page_data);
		set_recent_section_title(page_data.wikitext);
		if (options?.print_anchors) {
			CeL.info(`${tracking_section_title_history.name}: reduced anchors:`);
			console.trace(section_title_history[KEY_lower_cased_section_titles]);
		}
		return section_title_history;
	}

	// --------------------------------

	function check_and_set(section_title, type, revision) {
		if (!section_title_history[section_title]) {
			section_title_history[section_title] = {
				title: section_title,
				appear: null,
			};
		} else if (section_title_history[section_title][type]
			// appear: 首次出現, disappear: 最後一次消失
			&& type !== 'appear') {
			// 已經有比較新的資料。
			if (CeL.is_debug()) {
				CeL.warn(`${tracking_section_title_history.name}: ${type} of ${wiki.normalize_title(page_data)}#${section_title} is existed! ${JSON.stringify(section_title_history[section_title])
					}`);
				CeL.log(`Older to set ${type}: ${JSON.stringify(revision)}`);
			}
			return true;
		}
		section_title_history[section_title][type] = revision;
	}

	function set_rename_to(from, to) {
		if (from === to || section_title_history[from]?.is_present)
			return;

		let very_different;
		const reduced_from = reduce_section_title(from), reduced_to = reduce_section_title(to);
		// only fixes similar section names (to prevent errors)
		// 當標題差異過大時，不視為相同的意涵。會當作缺失。
		if (reduced_from.length > 4 && reduced_to.includes(reduced_from) || reduced_to.length > 4 && reduced_from.includes(reduced_to)
			//(very_different = 2 * CeL.edit_distance(from, to)) > Math.min(from.length , to.length)
			|| (very_different = CeL.LCS(from, to, 'diff').reduce((length, diff) => length + diff[0].length + diff[1].length, 0)) < Math.min(from.length, to.length)
		) {
			very_different = false;
		} else {
			very_different += `≥${Math.min(from.length, to.length)}`;
			CeL.error(`${set_rename_to.name}: Too different to be regarded as the same meaning (${very_different}): ${from}→${to}`);
		}

		const rename_to_chain = [from], is_directly_rename_to = section_title_history[to]?.is_present;
		while (!section_title_history[to]?.is_present && section_title_history[to]?.rename_to) {
			rename_to_chain.push(to);
			to = section_title_history[to].rename_to;
			if (rename_to_chain.includes(to)) {
				rename_to_chain.push(to);
				CeL.warn(`${tracking_section_title_history.name}: Looped rename chain @ ${CeL.wiki.title_link_of(page_data)}: ${rename_to_chain.join('→')}`);
				return;
			}
		}

		if (!section_title_history[from]) {
			set_section_title(section_title_history, from, {
				title: from
			}, options);
		}
		Object.assign(section_title_history[from], {
			is_directly_rename_to, very_different,
			// 警告: 需要自行檢查 section_title_history[to]?.is_present
			rename_to: to
		});
	}

	//if (section_title_history[KEY_got_full_revisions]) return section_title_history;

	CeL.info(`${tracking_section_title_history.name}: Trying to traversal all revisions of ${CeL.wiki.title_link_of(page_data)}...`);

	await wiki.tracking_revisions(page_data, (diff, revision, old_revision) => {
		//  `diff` 為從舊的版本 `old_revision` 改成 `revision` 時的差異。
		if (!section_title_history[KEY_latest_page_data]) {
			set_recent_section_title(CeL.wiki.revision_content(revision), revision);
		}

		//console.trace(diff);
		let [removed_text, added_text] = diff;
		//console.trace([diff, removed_text, added_text, revision]);
		//console.trace([previous_text_is_different, removed_text, added_text]);

		const _options = wiki.append_session_to_options();

		// using get_all_anchors()
		const removed_anchors = CeL.wiki.parse.anchor(removed_text, _options);
		const added_anchors = CeL.wiki.parse.anchor(added_text, _options);

		// "|| ''" 避免跳出警告
		removed_text = CeL.wiki.parser(removed_text || '', _options).parse();
		added_text = CeL.wiki.parser(added_text || '', _options).parse();

		// 當標題前後沒有空白之外的文字時，就當作是置換標題。
		const replaced_anchors = revision.replaced_anchors || (revision.replaced_anchors = Object.create(null));

		let previous_text_is_different = revision.previous_text_is_different;
		if (previous_text_is_different && diff.last_index && diff.index[1]) {
			// 因 !!previous_text_is_different, assert: Array.isArray(revision.last_index)
			//console.trace([revision.lines[last_index[1]], revision.lines[diff.index[1]], old_revision.lines[last_index[0]], old_revision.lines[diff.index[0]]]);

			// 中間這一段表示兩方相同的文字。
			if (revision.lines.slice(revision.last_index[1], diff.index[1][0]).join('').trim().length > 200)
				previous_text_is_different = false;
		}

		revision.last_index = diff.last_index;

		if (!previous_text_is_different) {
			for (let removed_index = 0, added_index = 0; removed_index < removed_text.length && added_index < added_text.length;) {
				while (typeof removed_text[removed_index] === 'string' && !(previous_text_is_different = removed_text[removed_index].trim())) removed_index++;
				if (previous_text_is_different) break;

				while (typeof added_text[added_index] === 'string' && !(previous_text_is_different = added_text[added_index].trim())) added_index++;
				if (previous_text_is_different) break;

				const removed_token = removed_text[removed_index++], added_token = added_text[added_index++];
				if (removed_token?.type === 'section_title' && added_token?.type === 'section_title') {
					const from = removed_token.link.id;
					const to = added_token.link.id;
					const length = Math.min(from.length, to.length);
					const edit_distance_score = 2 * CeL.edit_distance(from, to) / length;
					if (edit_distance_score < 1)
						replaced_anchors[from] = to;
				} else {
					// assert: removed_token || added_token 其中一個為非標題文字。
					previous_text_is_different = true;
					break;
				}
			}
		}

		revision.previous_text_is_different = previous_text_is_different;

		if (removed_anchors.length === 0 && added_anchors.length === 0)
			return;

		// TODO: https://ja.wikipedia.org/w/index.php?diff=83223729&diffmode=source
		if (!revision.removed_section_titles) {
			revision.removed_section_titles = [];
			revision.added_section_titles = [];
		}
		revision.removed_section_titles.append(removed_anchors);
		revision.added_section_titles.append(added_anchors);

	}, {
		revision_post_processor(revision) {
			// save memory 刪除不需要的提醒內容
			delete revision.slots;
			delete revision.diff_list;

			delete revision.last_index;
			delete revision.previous_text_is_different;

			// for old MediaWiki. e.g., moegirl
			delete revision.contentformat;
			delete revision.contentmodel;
			delete revision['*'];

			if (!revision.removed_section_titles) {
				// No new section title modified
				return;
			}

			revision.removed_section_titles = revision.removed_section_titles.filter(section_title => {
				// 警告：在 line_mode，"A \n"→"A\n" 的情況下，
				// "A" 會同時出現在增加與刪除的項目中，此時必須自行檢測排除。
				// 亦可能是搬到較遠地方。
				const index = revision.added_section_titles.indexOf(section_title);
				if (index >= 0) {
					revision.added_section_titles.splice(index, 1);
				} else {
					return true;
				}
			});

			/** {Boolean}有增加或減少的 anchor */
			let has_newer_data = false;
			revision.removed_section_titles.forEach(section_title => {
				if (check_and_set(section_title, 'disappear', revision)) {
					has_newer_data = true;
				}
			});
			revision.added_section_titles.forEach(section_title => {
				if (check_and_set(section_title, 'appear', revision)) {
					//has_newer_data = true;
				}
			});

			// We need this filter
			Object.keys(revision.replaced_anchors).forEach(from_anchor => {
				if (!revision.removed_section_titles.includes(from_anchor)) {
					// 例如轉換前後都有此 anchor，可能是移動段落。
					delete revision.replaced_anchors[from_anchor];
				}
			});
			//if (!CeL.is_empty_object(revision.replaced_anchors)) console.trace(revision.replaced_anchors);

			function check_rename_to(from, to) {
				// assert: section_title_history[from].disappear === revision && section_title_history[to].appear === revision
				if (!section_title_history[from].rename_to) {
					// from → to
					set_rename_to(from, to);
				} else if (to !== section_title_history[from].rename_to) {
					// 這個時間點之後，`from` 有再次出現並且重新命名過。
					CeL.warn(`#${from} is renamed to #${section_title_history[from].rename_to} in newer revision, but also renamed to #${to} in older revision`);
					// TODO: ignore reverted edit
				}
			}

			// 檢查變更紀錄可以找出變更章節名稱的情況。一增一減時，才當作是改變章節名稱。
			// TODO: 整次編輯幅度不大，且一增一減時，才當作是改變章節名稱。
			if (!has_newer_data && revision.removed_section_titles.length === 1 && revision.added_section_titles.length === 1) {
				const from = revision.removed_section_titles[0], to = revision.added_section_titles[0];
				//assert: Object.keys(revision.replaced_anchors).length === 1
				if (!revision.replaced_anchors[from] || revision.replaced_anchors[from] === to) {
					// or: revision.removed_section_titles.remove(from); revision.added_section_titles.remove(to);
					//delete revision.removed_section_titles;
					//delete revision.added_section_titles;
					check_rename_to(from, to);
					if (CeL.is_empty_object(revision.replaced_anchors))
						delete revision.replaced_anchors;
				} else if (revision.replaced_anchors[from]) {
					CeL.warn(`一對一有疑義: ${from}→${to}, replaced_anchors to ${revision.replaced_anchors[from]}`);
					delete revision.replaced_anchors;
				}

			} else {
				// https://ja.wikipedia.org/w/index.php?title=%E7%99%BD%E7%9F%B3%E7%BE%8E%E5%B8%86&diff=prev&oldid=84287198
				// TODO: assert: get_edit_distance_score('警視庁捜査一課9係 season11','警視庁捜査一課9係 season11（2006年）') < get_edit_distance_score('警視庁捜査一課9係 season11','警視庁捜査一課9係 season1（2016年）')
				function get_edit_distance_score(from, to) {
					const length = Math.min(from.length, to.length);
					// 不可使之通過: CeL.edit_distance('植松竜司郎','小田切敏郎'); CeL.edit_distance('赤井家・羽田家','赤井秀一');
					const edit_distance_score = 2 * (CeL.edit_distance(from, to)
						//+ length - CeL.longest_common_starting_length([from, to])
						// 微調
						- (from.length > to.length ? from.includes(to) : to.includes(from) ? 1 : 0)

						// 還可以嘗試若標題一對一對應，則相對應的標題微調減分。
					) / length;
					return edit_distance_score;
				}

				// edit_distance_lsit = [ [ edit_distance_score, from, to ], [ edit_distance_score, from, to ], ... ]
				const edit_distance_lsit = [];
				// 找出變更低於限度的，全部填入 edit_distance_lsit。
				revision.removed_section_titles.forEach(from => {
					revision.added_section_titles.forEach(to => {
						const edit_distance_score = get_edit_distance_score(from, to);
						if (edit_distance_score < 1) {
							edit_distance_lsit.push([edit_distance_score, from, to]);
						}
					});
				});
				// 升序序列排序: 小→大
				edit_distance_lsit.sort((_1, _2) => _1[0] - _2[0]);
				//if (edit_distance_lsit.length > 0) console.trace(edit_distance_lsit);

				// modify_hash[from] = to
				const modify_hash = Object.create(null);
				edit_distance_lsit.forEach(item => {
					const [/*edit_distance_score*/, from, to] = item;
					// 測試 from 是否已經有更匹配的 to。
					if (modify_hash[from]) return;
					modify_hash[from] = to;
					if (!revision.replaced_anchors[from] || revision.replaced_anchors[from] === to) {
						//revision.removed_section_titles.remove(from);
						//revision.added_section_titles.remove(to);
						check_rename_to(from, to);
					} else {
						// assert: !!revision.replaced_anchors[from] === true
						CeL.warn(`多對多有疑義: ${from}→${to}, replaced_anchors to ${revision.replaced_anchors[from]}`);
						delete revision.replaced_anchors[from];
					}
				});

				if (CeL.is_empty_object(revision.replaced_anchors)) {
					delete revision.replaced_anchors;
				} else {
					//console.trace(revision.replaced_anchors);
					Object.keys(revision.replaced_anchors).forEach(from_anchor => {
						check_rename_to(from_anchor, revision.replaced_anchors[from_anchor]);
					});
				}

				if (false) {
					if (revision.removed_section_titles.length === 0)
						delete revision.removed_section_titles;
					if (revision.added_section_titles.length === 0)
						delete revision.added_section_titles;
				}
			}

		},
		search_diff: true,
		rvlimit: 'max',
	});

	//console.trace(section_title_history)
	section_title_history[KEY_got_full_revisions] = true;
	return section_title_history;
}

async function get_all_links(page_data, options) {
	page_data = await wiki.page(page_data);
	const parsed = CeL.wiki.parser(page_data).parse();
	const reduced_anchor_to_page = Object.create(null);

	parsed.each('link', link_token => {
		if (link_token[1])
			return;

		// 假如完全刪除 #anchor，但存在 [[anchor]] 則直接改連至 [[anchor]]
		var page_title = wiki.normalize_title(link_token[0].toString());
		if (/^[\w\-]+:\S/.test(page_title)) {
			//e.g., 'wikt:ducky', 'jp:...'
			return;
		}
		reduced_anchor_to_page[reduce_section_title(page_title)] = [page_title];

		// 假如完全刪除 #anchor，但存在 [[[page|anchor]] 則直接改連至 [[page]]
		var display_text = link_token[2] && link_token[2].toString();
		if (display_text)
			reduced_anchor_to_page[reduce_section_title(display_text)] = [page_title];
	});

	return reduced_anchor_to_page;
}

async function check_page(target_page_data, options) {
	options = CeL.setup_options(options);
	const link_from = await wiki.redirects_here(target_page_data);
	//console.log(link_from);
	const target_page_redirects = Object.create(null);
	link_from
		.forEach(page_data => target_page_redirects[page_data.title] = true);
	// TODO: 字詞轉換 keys of target_page_redirects
	//console.log(Object.keys(target_page_redirects));

	target_page_data = link_from[0];
	//console.trace(wiki.is_namespace(target_page_data, 0));
	if (target_page_data.convert_from)
		target_page_redirects[target_page_data.convert_from] = true;
	const section_title_history = await tracking_section_title_history(target_page_data, {
		set_recent_section_only: true,
		print_anchors: options.print_anchors
	});

	// reduced_anchor_to_page[reduced anchor] = [page title, to anchor]
	const reduced_anchor_to_page = await get_all_links(target_page_data);
	if (options.print_anchors) {
		CeL.info(`${check_page.name}: reduced_anchor_to_page:`);
		console.trace(reduced_anchor_to_page);
	}

	await get_sections_moved_to(target_page_data, { ...options, section_title_history });
	//console.trace(section_title_history);

	link_from.append((await wiki.backlinks(options.backlink_of || target_page_data, {
		// Only edit broken links in these namespaces. 只更改這些命名空間中壞掉的文章 anchor 網頁錨點。
		namespace: options.namespace ?? (wiki.site_name() === 'enwiki' ? 0 : 'main|file|module|template|category|help|portal')
	})).filter(page_data =>
		!/\/(Sandbox|沙盒|Archives?|存檔|存档)( ?\d+)?$/.test(page_data.title)
		// [[User:Cewbot/log/20151002/存檔5]]
		// [[MediaWiki talk:Spam-blacklist/存档/2017年3月9日]]
		// [[Wikipedia:頁面存廢討論/記錄/2020/08/04]]
		&& !/\/(Archives?|存檔|存档|記錄|log)\//.test(page_data.title)
		// [[Wikipedia:Articles for creation/Redirects and categories/2017-02]]
		// [[Wikipedia:Database reports/Broken section anchors/1]] will auto-updated by bots
		// [[Wikipedia:Articles for deletion/2014 Formula One season (2nd nomination)]]
		&& !/^(Wikipedia:(Articles for deletion|Articles for creation|Database reports))\//.test(page_data.title)
	));

	if (link_from.length > 800 && !options.force_check
		// 連結的頁面太多時，只挑選較確定是改變章節名稱的。
		&& !(options.removed_section_titles && options.removed_section_titles.length === 1 && options.added_section_titles.length === 1)) {
		CeL.warn(`${check_page.name}: Too many pages (${link_from.length}) linking to ${CeL.wiki.title_link_of(target_page_data)}. Skip this page.`);
		return;
	}

	CeL.info(`${check_page.name}: ${progress_to_percent(options.progress)} Checking ${link_from.length} page(s) linking to ${CeL.wiki.title_link_of(target_page_data)}...`);
	//console.log(link_from);

	let working_queue;
	function add_summary(options, message) {
		if (Array.isArray(options.summary)) {
			message = message.toString();
			if (!options.summary.includes(message))
				options.summary.push(message);
		} else {
			options.summary = [options.summary + ': ' + message];
		}
	};
	// [[w:zh:Wikipedia:格式手册/链接#章節]]
	// [[w:ja:Help:セクション#セクションへのリンク]]
	// [[w:en:MOS:BROKENSECTIONLINKS]]
	const for_each_page_options = {
		no_message: true, no_warning: true,
		summary: CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, CeL.gettext('修正失效的網頁錨點')),
		bot: 1, minor: 1, nocreate: 1,
		// [badtags] The tag "test" is not allowed to be manually applied.
		//tags: wiki.site_name() === 'enwiki' ? 'bot trial' : '',
		tags: wiki.latest_task_configuration.general.tags,
	};

	// ----------------------------------------------------

	async function add_note_to_talk_page_for_broken_anchors(linking_page_data, anchor_token, record) {
		if (target_page_data.title === linking_page_data.title && anchor_token
			&& (!anchor_token[anchor_token.article_index || 0]
				|| anchor_token[anchor_token.article_index || 0] === target_page_data.title)
		) {
			// Will be modified at last.
			return;
		}

		function add_note_for_broken_anchors(talk_page_data) {
			// Modify from 20200122.update_vital_articles.js
			// TODO: fix disambiguation

			if (CeL.wiki.parse.redirect(talk_page_data)) {
				// prevent [[Talk:Ziaur Rahman]] redirecting to [[Talk:Ziaur Rahman (disambiguation)]]
				// this kind of redirects will be skipped and listed in [[Wikipedia:Database reports/Vital articles update report]] for manually fixing.
				// Warning: Should not go to here!
				CeL.warn(`${add_note_for_broken_anchors.name}: ${CeL.wiki.title_link_of(talk_page_data)} redirecting to ${CeL.wiki.title_link_of(CeL.wiki.parse.redirect(talk_page_data))}`);
				//console.log(talk_page_data.wikitext);
				return Wikiapi.skip_edit;
			}

			// the bot only fix namespace=talk.
			if (!wiki.is_namespace(talk_page_data, 'talk')) {
				// e.g., [[Wikipedia:Vital articles/Vital portals level 4/Geography]]
				CeL.warn(`${add_note_for_broken_anchors.name}: Skip invalid namesapce: ${CeL.wiki.title_link_of(talk_page_data)}`);
				//console.log(article_info);
				return Wikiapi.skip_edit;
			}

			//console.trace(talk_page_data);
			/** {Array} parsed page content 頁面解析後的結構。 */
			const parsed = CeL.wiki.parser(talk_page_data).parse();
			CeL.assert([CeL.wiki.content_of(talk_page_data), parsed.toString()], 'wikitext parser check for ' + CeL.wiki.title_link_of(talk_page_data));

			let has_broken_anchors_template;
			let removed_anchors = 0;
			parsed.each('template', template_token => {
				if (!wiki.is_template('Broken anchors', template_token))
					return;

				has_broken_anchors_template = true;
				const link_index = template_token.index_of[LINKS_PARAMETER];
				if (!link_index) {
					if (wikitext_to_add)
						template_token.push(LINKS_PARAMETER + '=' + wikitext_to_add);
					return parsed.each.exit;
				}

				// remove unknown anchors
				parsed.each.call(template_token[link_index], 'list', list_token => {
					for (let index = 0; index < list_token.length; index++) {
						const first_token = list_token[index][0]?.type && list_token[index][0];
						if (first_token && first_token.type === 'tag' && first_token.tag === 'nowiki'
							&& !main_page_wikitext.includes(first_token[1].toString())) {
							// remove item that is not in main article.
							list_token.splice(index--, 1);
							removed_anchors++;
							continue;
						}

						const link_token = CeL.wiki.parse(first_token[1].toString());
						//console.log([link_token, section_title_history[link_token.anchor]?.is_present]);
						if (section_title_history[link_token.anchor]?.is_present) {
							list_token.splice(index--, 1);
							removed_anchors++;
							continue;
						}
					}

					if (list_token.length === 0) {
						// 移除掉本 list。
						return parsed.each.remove_token;
					}
				});

				const original_text = template_token[link_index].toString();
				if (!anchor_token
					// have already noticed
					|| original_text.includes(anchor_token)) {
					return parsed.each.exit;
				}

				// wikitext_to_add startsWith('\n')
				template_token[link_index] = original_text.trim() + wikitext_to_add + '\n';
			});

			parsed.each('template', template_token => {
				if (!wiki.is_template('Broken anchors', template_token))
					return;
				if (template_token.parameters[LINKS_PARAMETER]?.toString()?.trim() === '') {
					// 移除掉整個 {{Broken anchors}}。
					// bot在巡查時，基本上會把修正過、沒有問題的通知刪掉，也就是說只要修正後就會自動清除告知，這樣應可以減少人力消耗。假如有必要順便連空白頁面都刪掉，或許得加上刪除的權限。
					return parsed.each.remove_token;
				}
			});

			if (removed_anchors > 0) {
				this.summary += (anchor_token ? ', ' : '') + CeL.gettext('移除%1個失效網頁錨點提醒', removed_anchors);
				//this.summary += '（全部です）';
				if (!anchor_token) {
					//this.allow_empty = 1;
					CeL.error(`${add_note_for_broken_anchors.name}: ${CeL.wiki.title_link_of(talk_page_data)}: ${CeL.gettext('移除%1個失效網頁錨點提醒', removed_anchors)}`);
				}
			} else if (!wikitext_to_add) {
				// assert: removed_anchors === 0
				return Wikiapi.skip_edit;
			}

			if (has_broken_anchors_template || !wikitext_to_add) {
				wikitext_to_add = parsed.toString();
				return wikitext_to_add.trim() ? wikitext_to_add : wiki.latest_task_configuration.general.action_for_blank_talk_page || '';
			}

			// Modify from 20200122.update_vital_articles.js
			// 添加在首段文字或首個 section_title 前，最後一個 template 後。
			wikitext_to_add = `{{Broken anchors|${LINKS_PARAMETER}=${wikitext_to_add}\n}}` + '\n\n';
			parsed.each((token, index, parent) => {
				if (typeof token === 'string' ? token.trim() : token.type !== 'transclusion') {
					const previous_node = index > 0 && parent[index - 1];
					// 避免多個換行。
					if (typeof previous_node === 'string' && /\n\n/.test(previous_node)) {
						parent[index - 1] = previous_node.replace(/\n$/, '');
					}
					parent.splice(index, 0, wikitext_to_add);
					wikitext_to_add = null;
					return parsed.each.exit;
				}
			}, {
				max_depth: 1
			});
			if (wikitext_to_add) {
				// 添加在頁面最前面。
				parsed.unshift(wikitext_to_add);
			}

			// assert: !!parsed.toString() === true
			return parsed.toString();
		}

		const main_page_wikitext = linking_page_data.wikitext;
		const talk_page_title = wiki.to_talk_page(linking_page_data);
		// text inside <nowiki> must extractly the same with the linking wikitext in the main article.
		let wikitext_to_add;
		if (anchor_token) {
			const move_to_page_title_via_link = reduced_anchor_to_page[reduce_section_title(anchor_token.anchor)];
			const target_link = move_to_page_title_via_link && (move_to_page_title_via_link[0] + (move_to_page_title_via_link[1] ? '#' + move_to_page_title_via_link[1] : ''));
			// 附帶說明一下。cewbot 所列出的網頁錨點會按照原先wikitext的形式來呈現。也就是說假如原先主頁面的wikitext是未編碼形式，表現出來也沒有編碼。範例頁面所展示的是因為原先頁面就有編碼過。按照原先格式呈現的原因是為了容易查找，直接複製貼上查詢就能找到。
			wikitext_to_add = `\n* <nowiki>${anchor_token}</nowiki> ${move_to_page_title_via_link
				? CeL.gettext('%1 已有專屬頁面：%2。', CeL.wiki.title_link_of((anchor_token.article_index ? anchor_token[anchor_token.anchor_index] : anchor_token[0]) + '#' + anchor_token.anchor), CeL.wiki.title_link_of(target_link))
				: ''
				} ${record
					// ，且現在失效中<syntaxhighlight lang="json">...</syntaxhighlight>
					? `${record.disappear ?
						// 警告: index 以 "|" 終結會被視為 patten 明確終結，並且 "|" 將被吃掉。
						CeL.gettext('此網頁錨點（%2）之前[[Special:Diff/%1|曾被其他用戶刪除過]]。', record.disappear.revid, anchor_token[1]) : ''
					// ，且現在失效中<syntaxhighlight lang="json">...</syntaxhighlight>
					} <!-- ${JSON.stringify(record)} -->` : ''}`;
			CeL.error(`${add_note_to_talk_page_for_broken_anchors.name}: ${CeL.wiki.title_link_of(talk_page_title)}: ${CeL.gettext('提醒失效的網頁錨點')}: ${CeL.wiki.title_link_of(talk_page_title)}`);
		}

		//console.trace(anchor_token);
		await wiki.edit_page(talk_page_title, add_note_for_broken_anchors, {
			//Notification of broken anchor
			notification_name: 'anchor-fixing',
			summary: `${CeL.wiki.title_link_of(wiki.latest_task_configuration.configuration_page_title, CeL.gettext('提醒失效的網頁錨點'))}: ${anchor_token || ''}`,
			bot: 1,
			//minor: 1,
			//nocreate: false,
			tags: wiki.latest_task_configuration.general.tags,
			allow_empty: 1,
		});
	}

	// ----------------------------------------------------

	function check_token(token, linking_page_data) {
		const page_title = (
			// assert: {{Section link}}
			token.page_title
			// assert: token.type === 'link'
			|| token[0]
			// for [[#anchor]]
			|| linking_page_data.title).toString();
		if (!(wiki.normalize_title(page_title) in target_page_redirects)
			|| !token.anchor || section_title_history[token.anchor]?.is_present
		) {
			// 當前有此 anchor。
			return;
		}
		//console.log(section_title_history);
		//console.log([!(wiki.normalize_title(page_title) in target_page_redirects),!token.anchor,section_title_history[token.anchor]?.is_present]);
		//console.trace(token);

		/**
		 * Change the target page title
		 * @param {String} to_page_title
		 * 
		 * @returns {Boolean} Nothing changed
		 */
		function change_to_page_title(to_page_title) {
			if (token.article_index) {
				if (wiki.normalize_title(token[token.article_index]) === to_page_title)
					return true;
				token[token.article_index] = to_page_title;
			} else {
				if (wiki.normalize_title(token[0]) === to_page_title)
					return true;
				token[0] = to_page_title;
			}
		}

		function change_to_anchor(to_anchor) {
			if (token.anchor_index) {
				token[token.anchor_index] = to_anchor || '';
			} else {
				token[1] = to_anchor ? '#' + to_anchor : '';
			}
		}

		const move_to_page_title = section_title_history[token.anchor]?.move_to_page_title;
		// https://meta.wikimedia.org/wiki/Community_Wishlist_Survey_2021/Bots_and_gadgets#Talk_page_archiving_bot_updating_incoming_links
		if (move_to_page_title) {
			if (change_to_page_title(move_to_page_title))
				return;
			// [[#A_B]] → [[#A B]]
			const section_title = section_title_history[token.anchor]?.title;
			change_to_anchor(section_title);
			const message = CeL.gettext('更新指向存檔的連結%1：%2', progress_to_percent(options.progress, true), token.toString());
			CeL.error(`${CeL.wiki.title_link_of(linking_page_data)}: ${message}`);
			add_summary(this, message);
			return true;
		}

		if (!section_title_history[KEY_got_full_revisions]) {
			if (working_queue) {
				working_queue.list.push(linking_page_data);
			} else {
				CeL.info(`${check_page.name}: Finding anchor ${token} that is not present in the latest revision of ${CeL.wiki.title_link_of(linking_page_data)}.`);
				// 依照 CeL.wiki.prototype.work, CeL.wiki.prototype.next 的作業機制，在此設定 section_title_history 會在下一批 link_from 之前先執行；不會等所有 link_from 都執行過一次後才設定 section_title_history。
				working_queue = tracking_section_title_history(target_page_data, { section_title_history })
					.catch(error => console.error(error))
					.then(() => CeL.info(`${CeL.wiki.title_link_of(linking_page_data)}: Get ${Object.keys(section_title_history).length} section title records from page revisions. Continue to check ${working_queue.list.length} pages.`))
					//.then(() => console.trace(section_title_history))
					.then(() => wiki.for_each_page(working_queue.list, resolve_linking_page, for_each_page_options))
					// free
					.then(() => working_queue = null);
				working_queue.list = [linking_page_data];
			}
			return;
		}

		const original_anchor = token.anchor_index ? token[token.anchor_index] : token[1];
		// assert: token.anchor === CeL.wiki.parse.anchor.normalize_anchor(original_anchor)
		const record = get_section_title_data(section_title_history, token.anchor);
		//console.trace(record);
		let rename_to = record?.rename_to;
		if (rename_to && section_title_history[rename_to]?.is_present) {
			let type;
			record.variant_of?.some(variant => {
				// 請注意: 網頁錨點有區分大小寫與繁簡體。
				if (variant[1] === rename_to) {
					if (variant[0] === MARK_case_change) {
						type = CeL.gettext('大小寫或空白相異的網頁錨點');
					} else {
						type = CeL.gettext('繁簡不符匹配而失效的網頁錨點');
					}
					return true;
				}
			});
			const ARROW_SIGN = record?.is_directly_rename_to || type ? '→' : '⇝';
			const hash = '#' + rename_to;

			CeL.info(`${CeL.wiki.title_link_of(linking_page_data)}: ${token}${ARROW_SIGN}${hash} (${JSON.stringify(record)})`);
			CeL.error(`${type ? type + ' ' : ''}${CeL.wiki.title_link_of(linking_page_data)}: ${original_anchor}${ARROW_SIGN}${hash}`);
			add_summary(this, `${type || `[[Special:Diff/${record.disappear.revid}|${new Date(record.disappear.timestamp).format({ format: '%Y-%2m-%2d', zone: 0 })}]]${record?.very_different ? ` (${CeL.gettext('差異極大')} ${record.very_different})` : ''}`
				} ${original_anchor}${ARROW_SIGN}${CeL.wiki.title_link_of(target_page_data.title + hash)}`);

			change_to_anchor(rename_to);
			//changed = true;
			return true;
		}

		// --------------------------------------------

		const move_to_page_title_via_link = reduced_anchor_to_page[reduce_section_title(token.anchor)];
		if (false && move_to_page_title_via_link) {
			// 有問題: 例如 [[Special:Diff/83294745]] [[名探偵コナンの登場人物#公安警察|風見裕也]] 不該轉為 [[公安警察|風見裕也]]。
			// 對人名連結可能較有用。
			if (change_to_page_title(move_to_page_title_via_link[0]))
				return;
			const target_link = move_to_page_title_via_link[0] + (move_to_page_title_via_link[1] ? '#' + move_to_page_title_via_link[1] : '');
			const message = CeL.gettext('%1 已有專屬頁面：%2。', CeL.wiki.title_link_of((token.article_index ? token[token.anchor_index] : token[0]) + '#' + token.anchor), CeL.wiki.title_link_of(target_link));
			CeL.error(`${CeL.wiki.title_link_of(linking_page_data)}: ${message}`);
			//console.trace(`${original_anchor} → ${move_to_page_title_via_link.join('#')}`);
			add_summary(this, message);
			change_to_anchor(move_to_page_title_via_link[1]);
			return true;
		}

		// --------------------------------------------

		// 檢測當前 anchors 是否有包含 token.anchor 的。
		function filter_reduced_section(reduced_section) {
			//console.log([token.anchor, reduced_section, 3 * CeL.edit_distance(token.anchor, reduced_section) / Math.min(token.anchor.length, reduced_section.length)]);
			// 3: prevent [[w:en:Special:Diff/286140354|Princess Abi]]
			return token.anchor.length > 4 && reduced_section.includes(token.anchor) || reduced_section.length > 4 && token.anchor.includes(reduced_section)
				// 選出接近之 anchor。
				|| 3 * CeL.edit_distance(token.anchor, reduced_section) / Math.min(token.anchor.length, reduced_section.length) < 1;
		}
		const reduced_section_includes_anchor =//token.anchor.length >= (/^[\w\s]+$/.test(token.anchor) ? 3 : 1) &&
			Object.keys(section_title_history[KEY_lower_cased_section_titles]).filter(filter_reduced_section)
				.append(Object.keys(section_title_history).filter(section_title => section_title_history[section_title].is_present && section_title_history[section_title].title === section_title).filter(filter_reduced_section));
		if (reduced_section_includes_anchor?.length === 1) {
			// 假如剛好只有一個，則將之視為過度簡化而錯誤。
			const rename_to = section_title_history[KEY_lower_cased_section_titles][reduced_section_includes_anchor[0]] || section_title_history[reduced_section_includes_anchor[0]].title;
			const num_token = token.anchor.replace(/[^\d]/g, '');
			const num_rename_to = rename_to.replace(/[^\d]/g, '');
			const need_check = !num_token || !num_rename_to || num_token.includes(num_rename_to) || num_rename_to.includes(num_token) ? ''
				// 當阿拉伯數字都增刪時較容易出問題。
				: CeL.gettext('請幫忙檢核此次編輯。');
			if ((!need_check
				// 必須避免已移去存檔頁面之 anchor。 e.g., [[w:zh:Special:Diff/65523646]]
				|| !/20\d{2}/.test(token.anchor) && !/\d月/.test(token.anchor)
				&& wiki.is_talk_namespace(linking_page_data)
				// 假如 token.anchor 消失時和 rename_to 共存，則不該是 token.anchor 換成 rename_to。
			) && !(section_title_history[rename_to]?.appear?.revid < section_title_history[token.anchor]?.disappear?.revid)) {
				add_summary(this, `${CeL.gettext('%1→當前最近似的網頁錨點%2', original_anchor, CeL.wiki.title_link_of(target_page_data.title + '#' + rename_to))
					}${need_check}`);
				if (section_title_history[token.anchor]) {
					//console.trace(section_title_history[token.anchor]);
				}
				change_to_anchor(rename_to);
				return true;
			}
		}
		//console.trace(reduced_section_includes_anchor);

		// --------------------------------------------

		CeL.warn(`${check_page.name}: Lost section ${token} @ ${CeL.wiki.title_link_of(linking_page_data)} (${original_anchor}: ${JSON.stringify(record)
			})${rename_to && section_title_history[rename_to] ? `\n→ ${rename_to}: ${JSON.stringify(section_title_history[rename_to])}` : ''
			}`);
		if (!options.is_archive && wiki.latest_task_configuration.general.add_note_to_talk_page_for_broken_anchors) {
			add_note_to_talk_page_for_broken_anchors(linking_page_data, token, record);
		}
	}

	// ------------------------------------------

	let pages_modified = 0;
	function resolve_linking_page(linking_page_data) {
		/** {Array} parsed page content 頁面解析後的結構。 */
		const parsed = linking_page_data.parse();
		// console.log(parsed);
		CeL.assert([linking_page_data.wikitext, parsed.toString()], 'wikitext parser check for ' + CeL.wiki.title_link_of(linking_page_data));
		if (!wiki.is_namespace(linking_page_data, 0) && linking_page_data.wikitext.length > /* 10_000_000 / 500 */ 500_000) {
			CeL.log(`${check_page.name}: Big page ${CeL.wiki.title_link_of(linking_page_data)}: ${CeL.to_KB(linking_page_data.wikitext.length)} chars`);
		}

		let changed;
		// handle [[link#anchor|display text]]
		parsed.each('link', token => {
			if (check_token.call(this, token, linking_page_data))
				changed = true;
		});

		parsed.each('template', (token, index, parent) => {
			// handle {{Section link}}
			if (wiki.is_template('Section link', token)) {
				const ARTICLE_INDEX = 1;
				if (token.parameters[ARTICLE_INDEX]) {
					const matched = token.parameters[ARTICLE_INDEX].toString().includes('#');
					if (matched) {
						token[token.index_of[ARTICLE_INDEX]] = token.parameters[ARTICLE_INDEX].toString().replace('#', '|');
						parent[index] = token = CeL.wiki.parse(token.toString());
					}
				}

				token.page_title = wiki.normalize_title(token.parameters[1].toString()) || linking_page_data.title;
				//console.trace(token);
				token.article_index = ARTICLE_INDEX;
				for (let index = 2; index < token.length; index++) {
					token.anchor_index = token.index_of[index];
					if (!token.anchor_index)
						continue;
					token.anchor = CeL.wiki.parse.anchor.normalize_anchor(token.parameters[index]);
					if (check_token.call(this, token, linking_page_data))
						changed = true;
				}

				return;
			}

			// handle {{Sfn}}
			if (wiki.is_template(['Sfn', 'Sfnp'], token)) {
				// TODO: 太過複雜 跳過
				return;
			}

		});

		if (!changed && CeL.fit_filter(options.force_check_talk_page, linking_page_data.title)) {
			// check talk page, 刪掉已有沒問題之 anchors。
			add_note_to_talk_page_for_broken_anchors(linking_page_data);
		}

		if (!changed)
			return Wikiapi.skip_edit;

		if (!Array.isArray(this.summary))
			add_summary(this, CeL.wiki.title_link_of(target_page_data));
		this.summary = this.summary.join(', ');
		pages_modified++;
		return parsed.toString();
	}

	await wiki.for_each_page(link_from, resolve_linking_page, for_each_page_options);
	await working_queue;

	await add_note_to_talk_page_for_broken_anchors(target_page_data);

	return pages_modified;
}
