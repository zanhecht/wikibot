﻿/*

2021/7/1 7:55:3	初版。
2022/1/20 2:46:48	再開。
	初版試營運。
	完成。正式運用。

 */

'use strict';

// Load CeJS library and modules.
require('../wiki loader.js');

// Load modules.
CeL.run([]);

// Set default language. 改變預設之語言。 e.g., 'zh'
set_language('en');

/** {Object}wiki operator 操作子. */
const wiki = new Wikiapi;

// ----------------------------------------------------------------------------

//CeL.get_URL.default_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4710.4 Safari/537.36';

// Only respect maxlag. 因為數量太多，只好增快速度。
CeL.wiki.query.default_edit_time_interval = 0;

/** PMC API articleid name to wikidata property id mapping */
const articleid_properties_mapper = {
	pubmed: 'P698',
	pmc: 'P932',
	// NCBI Bookshelf ID https://en.wikipedia.org/wiki/National_Center_for_Biotechnology_Information#NCBI_Bookshelf
	bookaccession: '',
	// =doi or doi 的後半部?
	pii: '',
	doi: 'P356',
	// EMSID
	mid: '',
	rid: '',
	eid: '',
	pmcid: '',
};
const articleid_properties_id_list = Object.entries(articleid_properties_mapper).filter(pair => !!pair[1]).map(pair => {
	const [idtype, property_id] = pair;
	return '?' + idtype;
}).join(' ');
const articleid_properties_id_assignment = Object.entries(articleid_properties_mapper).filter(pair => !!pair[1]).map(pair => {
	const [idtype, property_id] = pair;
	return `
	OPTIONAL { ?item wdt:${property_id} ?${idtype}. }`;
}).join('');

const published_source_mapper__file_path = base_directory + 'published_source_mapper.json';
const published_source_mapper = new Map((() => {
	let data = CeL.read_file(published_source_mapper__file_path);
	if (data) return JSON.parse(data.toString());
	return Object.entries({
		//Genetics: 'Q3100575',
	});
})());

const language_code_mapper__file_path = base_directory + 'language_code_mapper.json';
const language_code_mapper = new Map((() => {
	let data = CeL.read_file(language_code_mapper__file_path);
	if (data) return JSON.parse(data.toString());
	return Object.entries({
		//eng: 'Q1860',
	});
})());

const problematic_articles = [];
const MAX_error_reported = 100;

// ----------------------------------------------

// 讀入手動設定 manual settings。
async function adapt_configuration(latest_task_configuration) {
	//console.log(latest_task_configuration);
	// console.log(wiki);

	// ----------------------------------------------------

	const { general } = latest_task_configuration;

}

// ----------------------------------------------------------------------------

// 先創建出/準備好本任務獨有的目錄，以便後續將所有的衍生檔案，如記錄檔、cache 等置放此目錄下。
prepare_directory(base_directory);
// prepare_directory(base_directory, true);

(async () => {
	login_options.configuration_adapter = adapt_configuration;
	login_options.API_URL = 'wikidata';
	//console.log(login_options);
	await wiki.login(login_options);
	// await wiki.login(null, null, use_language);
	await main_process();
})();

async function main_process() {
	if (language_code_mapper.size < 100)
		await fill_language_code_mapper();

	if (published_source_mapper.size < 1000)
		await fill_published_source_mapper();
	console.assert(published_source_mapper.get('genetics') === 'Q3100575');
	console.assert(published_source_mapper.get('biochemical and biophysical research communications') === 'Q864228');

	const date = new Date('2021-05-01');
	// Set to yesterday.
	date.setDate(date.getDate() - 1);
	const PubMed_ID_list = (await get_PubMed_ID_list(date)).slice(0, 1)
		// https://query.wikidata.org/#SELECT%20%3Fitem%20%3FitemLabel%20%3FitemDescription%20%3Fvalue%20%3Fst%20%3Fids%20%3Fsl%0AWHERE%0A%7B%0A%20%20SERVICE%20bd%3Asample%20%7B%20%3Fitem%20wdt%3AP698%20%3Fvalue.%20bd%3AserviceParam%20bd%3Asample.limit%20200%20%7D%0A%20%20OPTIONAL%20%7B%20%3Fitem%20wikibase%3Astatements%20%3Fst%20%3B%20wikibase%3Aidentifiers%20%3Fids%20%3B%20wikibase%3Asitelinks%20%3Fsl%20%7D%0A%20%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22%5BAUTO_LANGUAGE%5D%2Cen%22.%20%7D%0A%7D%0A
		&& ['33772245', '34572048', '34433058']
		&& ['34380020', '34411149', '34373751']
		// 11373397: PubMed 經常進行某種標題翻譯 https://www.wikidata.org/wiki/Wikidata:Requests_for_permissions/Bot/LargeDatasetBot
		// Tested:
		&& ['17246615', '1201098', '32650478', '33914448', '33932783', '11373397']
		;

	for (let index = 0; index < PubMed_ID_list.length;) {
		const PubMed_ID = PubMed_ID_list[index++];
		CeL.log_temporary(`${index}/${PubMed_ID_list.length} PubMed_ID ${PubMed_ID}`);
		try {
			await for_each_PubMed_ID(PubMed_ID);
		} catch (e) {
			// Still import next article.
		}
	}

	if (problematic_articles.length > 0) {
		//console.trace(problematic_articles);
		problematic_articles.unshift(['PubMed ID', 'Items']);
		//console.trace(CeL.wiki.array_to_table(problematic_articles, { 'class': "wikitable" }));
		//console.trace(wiki.append_session_to_options());
		const wikitext = date.format('%Y-%2m-%2d') + '\n\n' + CeL.wiki.array_to_table(problematic_articles, { 'class': "wikitable" });
		await wiki.edit_page(log_to + '/PubMed ID duplicates', wikitext, { bot: 1, nocreate: 1, summary: `Error report: ${problematic_articles.length - 1} article(s)` });
	}

	routine_task_done('1 day');
}

// ----------------------------------------------------------------------------

async function fill_language_code_mapper() {

	async function set_language_code_item_list(property_id) {
		const language_code_item_list = await wiki.SPARQL(`
SELECT ?item ?itemLabel ?value
WHERE 
{
	?item wdt:${property_id} ?value.
	SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`);
		language_code_item_list.forEach(language_data => {
			const language_code = CeL.wiki.data.value_of(language_data.value);
			if (!language_code_mapper.has(language_code)) {
				const entity_id = CeL.wiki.data.value_of(language_data.item).match(/\/(Q\d+)$/)[1];
				language_code_mapper.set(language_code, entity_id);
			}
		});
	}

	// ISO 639-3 code
	await set_language_code_item_list('P220');

	// ISO 639-2 code
	await set_language_code_item_list('P219');

	// ISO 639-1 code
	await set_language_code_item_list('P218');

	CeL.write_file(language_code_mapper__file_path, JSON.stringify(Array.from(language_code_mapper)));

}

function normalize_source_name(source_name) {
	return source_name.replace(/[,;:.]/g, '').trim().toLowerCase();
}

async function fill_published_source_mapper(id) {
	if (!id) {
		// read cache
		for (id of ['Q5633421', 'Q5633421', 'Q737498']) {
			await fill_published_source_mapper(id);
		}
		CeL.write_file(published_source_mapper__file_path, JSON.stringify(Array.from(published_source_mapper)));
		CeL.info(`fill_published_source_mapper: Get ${published_source_mapper.size} sources.`);
		return;
	}

	CeL.log_temporary(`Get ${id}`);
	const initial_size = published_source_mapper.size;
	const source_item_list = await wiki.SPARQL(`
SELECT ?item ?itemLabel
WHERE 
{
	?item wdt:P31 wd:${id}.
	SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
#LIMIT 10
`);

	for (const source_data of source_item_list) {
		const entity_id = CeL.wiki.data.value_of(source_data.item).match(/\/(Q\d+)$/)[1];
		let source_name = CeL.wiki.data.value_of(source_data.itemLabel);
		let source_key = normalize_source_name(source_name);
		//console.log([source_name, source_key, entity_id]);
		if (!published_source_mapper.has(source_key))
			published_source_mapper.set(source_key, entity_id);

		// "Acta Crystallographica Section B: Structural Science, Crystal Engineering and Materials"
		// should NOT match 'Acta crystallographica. Section B, Structural science'
	}

	CeL.debug(`${published_source_mapper.size - initial_size}/${source_item_list.length} sources filled.`, 1, 'fill_published_source_mapper');
}

// ----------------------------------------------------------------------------

/**
 * get PubMed Central ID list
 * @param {String} date date to get 
 * @returns {Array} PubMed IDs
 */
async function get_PubMed_ID_list(date) {
	// https://www.ncbi.nlm.nih.gov/home/develop/api/
	// https://www.ncbi.nlm.nih.gov/books/NBK25499/#chapter4.ESearch
	const NCBI_API_URL = new CeL.URI('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
	NCBI_API_URL.search_params.set_parameters({
		db: "pubmed",
		retmode: "json",
		// retstart: 1,
		retmax: 100000,
		mindate: date.format('%Y/%2m/%2d'),
		maxdate: date.format('%Y/%2m/%2d'),
	});

	//console.trace(NCBI_API_URL.toString());
	const esearchresult = (await (await CeL.fetch(NCBI_API_URL.toString())).json()).esearchresult;
	const PubMed_ID_list = esearchresult.idlist;
	//console.trace(PubMed_ID_list);
	return PubMed_ID_list;
}

// ----------------------------------------------------------------------------

const summary_source_posifix = ' from NCBI, Europe PMC and CrossRef';

async function fetch_PubMed_ID_data_from_service(PubMed_ID) {
	// https://www.ncbi.nlm.nih.gov/books/NBK25499/#chapter4.ESummary
	// https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=33932783,33932782
	const NCBI_API_URL = new CeL.URI('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
	NCBI_API_URL.search_params.set_parameters({
		db: "pubmed",
		retmode: "json",
		id: PubMed_ID,
	});

	// https://europepmc.org/RestfulWebService
	// https://www.ebi.ac.uk/europepmc/webservices/rest/search?resulttype=core&format=json&query=EXT_ID:33932783%20AND%20SRC:MED
	const Europe_PMC_API_URL = new CeL.URI('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
	Europe_PMC_API_URL.search_params.set_parameters({
		resulttype: "core",
		format: "json",
		query: "SRC:MED AND EXT_ID:" + PubMed_ID
	});

	// ----------------------------------------------------

	const results = Object.create(null);
	await Promise.allSettled([
		//(await (await CeL.fetch(NCBI_API_URL.toString())).json()).result[PubMed_ID]
		CeL.fetch(NCBI_API_URL.toString()).then(result => result.json()).then(result => results.NCBI_article_data = result.result[PubMed_ID], console.error),
		CeL.fetch(Europe_PMC_API_URL.toString()).then(result => result.json()).then(result => results.Europe_PMC_article_data = result.resultList.result[0], console.error),
	]);

	// ----------------------------------------------------

	if (results.NCBI_article_data) {
		results.NCBI_article_data.wikidata_references = {
			// 載於 NCBI: National Center for Biotechnology Information
			P248: 'Q82494',
			[articleid_properties_mapper.pubmed]: PubMed_ID,
			// 來源網址
			P854: NCBI_API_URL.toString(),
			// 檢索日期
			P813: new Date,
		};
	}

	if (results.Europe_PMC_article_data) {
		results.Europe_PMC_article_data.wikidata_references = {
			// 載於 Europe PMC
			P248: 'Q5412157',
			[articleid_properties_mapper.pubmed]: PubMed_ID,
			// 來源網址
			P854: Europe_PMC_API_URL.toString(),
			// 檢索日期
			P813: new Date,
		};
	}

	//console.trace(results);
	return results;
}

async function fetch_DOI_data_from_service(DOI) {
	// https://api.crossref.org/swagger-ui/index.html
	// https://api.crossref.org/works/10.1107/S0108768100019121
	const CrossRef_API_URL = new CeL.URI('https://api.crossref.org/works/' + DOI);
	if (false) {
		CrossRef_API_URL.search_params.set_parameters({
			mailto: 'https://www.wikidata.org/wiki/User:' + login_options.owner_name
		});
	}

	// ----------------------------------------------------

	const results = Object.create(null);
	await Promise.allSettled([
		CeL.fetch(CrossRef_API_URL.toString()).then(result => result.json()).then(result => results.CrossRef_article_data = result.message, console.error),
	]);

	// ----------------------------------------------------

	if (results.CrossRef_article_data) {
		results.CrossRef_article_data.wikidata_references = {
			// 載於
			P248: 'Q5188229',
			[articleid_properties_mapper.doi]: DOI,
			// 來源網址
			P854: CrossRef_API_URL.toString(),
			// 檢索日期
			P813: new Date,
		};
	}

	//console.trace(results);
	return results;
}

async function get_entity_id_of_ORCID(ORCID, author_name) {
	if (!ORCID) return;

	// https://query.wikidata.org/#%23%20items%20with%20property%20P496%20and%20most%20identifiers%0A%23%20added%20by%20User%3AJura1%2C%202017-07-30%0ASELECT%20%3Fitem%20%3FitemLabel%20%3Fvalue%20%3Fids%0A%7B%0A%20%20%3Fitem%20wdt%3AP496%20%220000-0002-7122-2650%22.%0A%20%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22%5BAUTO_LANGUAGE%5D%2Cen%22.%20%7D%0A%7D%0AORDER%20BY%20DESC%28%3Fids%29%20%3Fitem
	CeL.log_temporary(`get_entity_id_of_ORCID: Get entity_id of ORCID = ${ORCID}${author_name ? ` (${author_name})` : ''}`);
	const author_item_list = await wiki.SPARQL(`
SELECT ?item ?itemLabel
{
	?item wdt:P496 "${ORCID}".
	SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
}
`);
	if (author_item_list.length === 0) {
		// TODO: create author item
	}
	const entity_id = author_item_list.id_list()[0];
	return entity_id;
}

async function get_entity_id_of_ISSN(ISSN) {
	if (!ISSN) return;

	CeL.log_temporary(`get_entity_id_of_ISSN: Get entity_id of ISSN = ${ISSN}`);
	const item_list = await wiki.SPARQL(`
SELECT ?item ?itemLabel
{
	?item wdt:P236 "${ISSN}".
	SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
}
`);
	if (item_list.length === 0) {
		// TODO: create item
	}
	const entity_id = item_list.id_list()[0];
	return entity_id;
}

// ----------------------------------------------------------------------------

// For Europe_PMC_article_data.title & NCBI_article_data.title
//https://www.wikidata.org/wiki/Wikidata:Requests_for_permissions/Bot/LargeDatasetBot
// 撇開 mathml 之類的問題不談，它似乎經常在文章標題的末尾添加句號
// 標題的翻譯，用方括號括起來。
// https://www.ebi.ac.uk/europepmc/webservices/rest/search?resulttype=core&format=json&query=EXT_ID:33932783%20AND%20SRC:MED
function normalize_title(title) {
	return title && title
		// remove <i>...</i>. https://www.wikidata.org/wiki/Q97521125
		.replace(/<[\/\w][^<>]*>/g, '').trim().replace(/^\[(.+)\]$/, '$1').replace(/\s*\.$/, '');
}

async function for_each_PubMed_ID(PubMed_ID) {
	const { NCBI_article_data, Europe_PMC_article_data } = await fetch_PubMed_ID_data_from_service(PubMed_ID);
	console.trace(NCBI_article_data, Europe_PMC_article_data);
	console.assert(PubMed_ID === NCBI_article_data.uid && NCBI_article_data.uid === Europe_PMC_article_data.id && Europe_PMC_article_data.id === Europe_PMC_article_data.pmid);

	let CrossRef_article_data;
	if (Array.isArray(NCBI_article_data.articleids)) {
		let DOI;
		NCBI_article_data.articleids.some(articleid => articleid.idtype === 'doi' && (DOI = articleid.value));
		if (DOI) {
			CrossRef_article_data = (await fetch_DOI_data_from_service(DOI)).CrossRef_article_data;
			console.trace(CrossRef_article_data);
		}
	}
	CrossRef_article_data = CrossRef_article_data || Object.create(null);

	// ----------------------------------------------------
	// Generate data to modify

	// @see
	// https://www.wikidata.org/wiki/User:Citationgraph_bot
	// https://www.wikidata.org/wiki/Wikidata:Requests_for_permissions/Bot/LargeDatasetBot

	const data_to_modify = {
		labels: {
			en: normalize_title(NCBI_article_data.title || NCBI_article_data.booktitle)
		},
		claims: [
			{
				// 'instance of': 'scholarly article',
				P31: 'Q13442814',
				//references: NCBI_article_data.wikidata_references
			},
		]
	};

	// CrossRef may have the original title.
	let main_title = normalize_title(CrossRef_article_data.title && CrossRef_article_data.title[0]);
	if (main_title) {
		//const language_entity_id = language_code_mapper.get(CrossRef_article_data.language);
		data_to_modify.labels[CrossRef_article_data.language] = main_title;
		data_to_modify.claims.push({
			// title 標題 (P1476)
			P1476: main_title,
			language: CrossRef_article_data.language,
			references: CrossRef_article_data.wikidata_references
		});
	} else {
		main_title = normalize_title(Europe_PMC_article_data.title
			// Should not go to here!
			|| data_to_modify.labels.en);
		if (!main_title) {
			CeL.error(`${for_each_PubMed_ID.name}: No title for PubMed ID ${PubMed_ID}!`);
			return;
		}
	}

	if (main_title !== normalize_title(Europe_PMC_article_data.title)) {
		const Europe_PMC_title = normalize_title(Europe_PMC_article_data.title);
		if (!Array.isArray(CrossRef_article_data.title) || !CrossRef_article_data.title.some(title => title === Europe_PMC_title)) {
			data_to_modify.claims.push({
				// title 標題 (P1476)
				// Usually English. https://www.ebi.ac.uk/europepmc/webservices/rest/search?resulttype=core&format=json&query=SRC%3AMED%20AND%20EXT_ID%3A33932783
				P1476: Europe_PMC_title,
				references: Europe_PMC_article_data.wikidata_references
			});
		}
	}
	if (main_title !== normalize_title(NCBI_article_data.title || NCBI_article_data.booktitle)) {
		// NCBI_article_data.vernaculartitle may contains original title. e.g., https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=33932783
		const NCBI_title = normalize_title(NCBI_article_data.title || NCBI_article_data.booktitle);
		if (NCBI_title && NCBI_title !== normalize_title(Europe_PMC_article_data.title)) {
			// Should not go to here.
			data_to_modify.claims.push({
				// title 標題 (P1476)
				P1476: NCBI_title,
				references: NCBI_article_data.wikidata_references
			});
		}
	}

	if (Array.isArray(NCBI_article_data.lang)) {
		// "eng", "spa"
		NCBI_article_data.lang.forEach(language_code => {
			const language_entity_id = language_code_mapper.get(language_code);
			if (language_entity_id) {
				data_to_modify.claims.push({
					// language of work or name (P407)
					P407: language_entity_id,
					references: NCBI_article_data.wikidata_references
				});
			} else {
				CeL.warn(`Unknown language code: ${language_code} (${main_title})`);
			}
		});
	}

	if (Array.isArray(Europe_PMC_article_data.authorList?.author)) {
		// authors of NCBI are relatively complete
		let index = 0;
		for (const author_data of Europe_PMC_article_data.authorList.author) {
			let author_value;
			if (author_data.authorId?.type === "ORCID"
				&& (author_value = await get_entity_id_of_ORCID(author_data.authorId.value, author_data.fullName))) {
				data_to_modify.claims.push({
					// author (P50) 作者
					P50: author_value,
					qualifiers: {
						// series ordinal (P1545) 系列序號
						P1545: ++index
					},
					references: Europe_PMC_article_data.wikidata_references
				});
				continue;
			}

			author_value = author_data.firstName && author_data.lastName
				// "H Schenk" → "H. Schenk" https://www.wikidata.org/wiki/Q29029898
				// "Abeer H" → "Abeer H." https://www.wikidata.org/wiki/Q29029898
				? author_data.firstName.trim().replace(/([a-z] [A-Z])$/, '$1.') + (author_data.firstName === author_data.initials ? '.' : '') + ' ' + author_data.lastName.trim()
				: author_data.fullName.trim();
			console.assert(!!author_value);
			const qualifiers = {
				// series ordinal (P1545) 系列序號
				P1545: ++index
			};
			if (author_data.authorId?.type === "ORCID") {
				qualifiers.P496 = author_data.authorId.value;
			}
			data_to_modify.claims.push({
				// author name string (P2093) 作者姓名字符串
				P2093: author_value,
				qualifiers,
				references: Europe_PMC_article_data.wikidata_references
			});
		}

	} else if (Array.isArray(NCBI_article_data.authors)) {
		NCBI_article_data.authors.forEach((author_data, index) => {
			data_to_modify.claims.push({
				// author name string (P2093) 作者姓名字符串
				// https://www.wikidata.org/wiki/Wikidata:Requests_for_permissions/Bot/LargeDatasetBot
				// PubMed 還刪除了作者姓名首字母后面的句點字符並顛倒過來，以便姓氏在前，因此在 PubMed（和導入的）中，名稱類似於“Peschar R”而不是原始出版物的“R. Peschar” . 
				P2093: author_data.name.replace(/^(.+) ([A-Z])$/, '$2. $1'),
				qualifiers: {
					// series ordinal (P1545) 系列序號
					P1545: index + 1
				},
				references: NCBI_article_data.wikidata_references
			});
		});
	}

	if (Array.isArray(NCBI_article_data.history) && NCBI_article_data.history.length > 0) {
		let publication_date = NCBI_article_data.history.filter(history => !!history.date);
		const PMC_publication_date = publication_date.filter(history => history.pubstatus === 'pubmed');
		if (PMC_publication_date.length > 0)
			publication_date = PMC_publication_date;
		if (publication_date.length > 0) {
			publication_date = publication_date[0].date;
			data_to_modify.claims.push({
				// publication date (P577) 出版日期
				// UTC+0: 確保日期不跑掉
				P577: publication_date + ' UTC+0',
				references: NCBI_article_data.wikidata_references
			});
			publication_date = new Date(publication_date);
			// https://query.wikidata.org/#SELECT%20%3Fitem%20%3FitemLabel%20%3FitemDescription%20%3Fvalue%20%3Fst%20%3Fids%20%3Fsl%0AWHERE%0A%7B%0A%20%20SERVICE%20bd%3Asample%20%7B%20%3Fitem%20wdt%3AP698%20%3Fvalue.%20bd%3AserviceParam%20bd%3Asample.limit%20200%20%7D%0A%20%20OPTIONAL%20%7B%20%3Fitem%20wikibase%3Astatements%20%3Fst%20%3B%20wikibase%3Aidentifiers%20%3Fids%20%3B%20wikibase%3Asitelinks%20%3Fsl%20%7D%0A%20%20SERVICE%20wikibase%3Alabel%20%7B%20bd%3AserviceParam%20wikibase%3Alanguage%20%22%5BAUTO_LANGUAGE%5D%2Cen%22.%20%7D%0A%7D%0A
			data_to_modify.descriptions = {
				en: `scientific ${NCBI_article_data.doctype === 'book' ? 'book' : 'article'} published on ` + publication_date.toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' }),
				zh: publication_date.getFullYear() + '年學術' + (NCBI_article_data.doctype === 'book' ? '書籍' : '文章'),
				ja: publication_date.getFullYear() + '年の' + (NCBI_article_data.doctype === 'book' ? '学術書' : '学術論文'),
			};
		}
	} else {
		data_to_modify.descriptions = {
			en: `scientific ${NCBI_article_data.doctype === 'book' ? 'book' : 'article'}`,
			zh: '學術' + (NCBI_article_data.doctype === 'book' ? '書籍' : '文章'),
			ja: NCBI_article_data.doctype === 'book' ? '学術書' : '学術論文',
		};
	}

	if (NCBI_article_data.issn || NCBI_article_data.essn) {
		const source_entity_id = await get_entity_id_of_ISSN(NCBI_article_data.issn) || await get_entity_id_of_ISSN(NCBI_article_data.essn);
		if (source_entity_id) {
			data_to_modify.claims.push({
				// published in (P1433) 發表於
				P1433: source_entity_id,
				qualifiers: {
					P478: NCBI_article_data.volume,
					P433: NCBI_article_data.issue,
					P304: NCBI_article_data.pages//.replace(/^(\d+)-(\d+)$/, '$1–$2')
				},
				references: NCBI_article_data.wikidata_references
			});
			data_to_modify.claims.source_filled = true;
		}
	}
	if (!data_to_modify.claims.source_filled && NCBI_article_data.fulljournalname) {
		// Using ISSN/ESSN is better than NCBI_article_data.fulljournalname. https://www.wikidata.org/wiki/Q110634863
		// PubMed_ID=17246615
		const source_name = normalize_source_name(NCBI_article_data.fulljournalname);
		const source_entity_id = published_source_mapper.get(source_name);
		if (!source_entity_id) {
			//console.trace(NCBI_article_data);
			CeL.error(`${PubMed_ID}: Unknown fulljournalname: ${JSON.stringify(source_name)}. Please add it to published_source_mapper!`);
		}
		// https://www.wikidata.org/wiki/Special:EntityData/Q5418627.json
		data_to_modify.claims.push({
			// published in (P1433) 發表於
			P1433: source_entity_id,
			qualifiers: {
				P478: NCBI_article_data.volume,
				P433: NCBI_article_data.issue,
				P304: NCBI_article_data.pages//.replace(/^(\d+)-(\d+)$/, '$1–$2')
			},
			references: NCBI_article_data.wikidata_references
		});
		data_to_modify.claims.source_filled = true;
	}

	if (NCBI_article_data.doctype === 'book') {
		data_to_modify.claims.push({
			// distribution format: printed book
			P437: 'Q11396303',
			references: NCBI_article_data.wikidata_references
		});
	}

	if (NCBI_article_data.publishername) {
		// PubMed_ID=33914448
		const publisher = {
			// publisher (P123)
			P123: NCBI_article_data.publishername,
			references: NCBI_article_data.wikidata_references
		};
		if (NCBI_article_data.publisherlocation) {
			publisher.qualifiers = {
				// "Southampton (UK)" → "Southampton, UK"
				P291: NCBI_article_data.publisherlocation.replace(/ +\((.+)\)$/, ', $1')
			};
		}
		data_to_modify.claims.push(publisher);
	}

	// ----------------------------------------------------
	// 檢查是否有重複項目

	const id_filter = [];
	id_filter.toString = function () { return this.join(''); };

	// https://www.chinaw3c.org/REC-sparql11-overview-20130321-cn.html
	// http://www.ruanyifeng.com/blog/2020/02/sparql.html
	// https://longaspire.github.io/blog/%E5%9B%BE%E8%B0%B1%E5%AE%9E%E8%B7%B5%E7%AC%94%E8%AE%B02_1/
	const SPARQL = [`
SELECT DISTINCT ?item ?itemLabel ${articleid_properties_id_list}
WHERE {`,
		id_filter, `
	{
		?item wdt:P31 wd:Q13442814;
			?label ${JSON.stringify(data_to_modify.labels.en)}@en.
	}
	SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
	${articleid_properties_id_assignment}
}
ORDER BY DESC (?item)
`];

	// ids of NCBI are relatively complete
	NCBI_article_data.articleids.forEach(articleid => {
		const idtype = articleid.idtype;
		if (!(idtype in articleid_properties_mapper)) {
			//console.trace(NCBI_article_data);
			throw new Error(`${PubMed_ID}: Unknown idtype: ${JSON.stringify(idtype)}. Please add it to articleid_properties_mapper!`);
		}
		let property_id = articleid_properties_mapper[idtype];
		if (!property_id) {
			// Do not use this id.
			return;
		}

		let id = articleid.value;
		switch (idtype) {
			case 'doi':
				//https://www.wikidata.org/wiki/Wikidata:Requests_for_permissions/Bot/LargeDatasetBot
				// DOI's are technically case insensitive - SourceMD has been upper-casing them before adding them.
				id = id.toUpperCase();
				break;
			case 'pmc':
				id = id.replace(/^PMC/, '');
				break;
		}
		id_filter.push(`
	{ ?item wdt:${property_id} ${JSON.stringify(id)}. } UNION`);

		data_to_modify.claims.push({
			[property_id]: id,
			references: NCBI_article_data.wikidata_references
		});
	});

	//console.trace(SPARQL.join(''));
	const article_item_list = await wiki.SPARQL(SPARQL.join(''));
	//console.trace(article_item_list);
	//console.trace(article_item_list.id_list());

	if (article_item_list.length > 1) {
		if (problematic_articles.length < MAX_error_reported) {
			// count > 1: error, log the result.
			console.trace(article_item_list);
			problematic_articles.push([
				PubMed_ID,
				article_item_list.id_list().map(id => `{{Q|${id}}}`).join(', '),
				//NCBI_article_data,
			]);
		}
		return;
	}

	// ----------------------------------------------------

	console.log(JSON.stringify(data_to_modify));
	console.trace(data_to_modify);
	//return;
	//CeL.set_debug(6);

	if (article_item_list.length === 0) {
		// no result: Need to add.
		await wiki.new_data_entity(data_to_modify, { bot: 1, summary: `Import new ${NCBI_article_data.doctype}${summary_source_posifix}` });
		return;
	}

	// assert: article_item_list.length === 1
	// Only one result: Already added. Append.
	const article_item = await wiki.data(article_item_list.id_list()[0]);
	//console.trace([article_item_list[0], article_item]);
	await article_item.modify(data_to_modify, { bot: 1, summary: `Modify ${NCBI_article_data.doctype} data${summary_source_posifix}` });
}
