const axios = require('axios');
const xml2js = require('xml2js');
const _ = require('lodash');

class RetrievalService {
    constructor() {
        this.parser = new xml2js.Parser({ explicitArray: false });
    }

    async searchAll(query, disease, context) {
        const expandedQuery = query + (disease ? ` ${disease}` : '');
        
        const [pubmedResults, openAlexResults, clinicalTrials] = await Promise.all([
            this.fetchPubMed(expandedQuery),
            this.fetchOpenAlex(expandedQuery),
            this.fetchClinicalTrials(disease, query)
        ]);

        const merged = this.rankAndFilter(pubmedResults, openAlexResults, clinicalTrials, expandedQuery);
        return merged;
    }

    async fetchPubMed(query) {
        try {
            // Step 1: Search - Fetching a broad candidate pool (100 candidates)
            const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=100&retmode=json`;
            const searchRes = await axios.get(searchUrl);
            const ids = searchRes.data.esearchresult.idlist;

            if (!ids || ids.length === 0) return [];

            // Step 2: Fetch Details
            const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml`;
            const fetchRes = await axios.get(fetchUrl);
            
            const parsed = await this.parser.parseStringPromise(fetchRes.data);
            const articles = _.castArray(parsed.PubmedArticleSet.PubmedArticle);

            return articles.map(art => {
                const article = art.MedlineCitation.Article;
                return {
                    title: article.ArticleTitle,
                    abstract: article.Abstract?.AbstractText || '',
                    authors: _.castArray(article.AuthorList?.Author).map(a => `${a.LastName} ${a.Initials}`).filter(Boolean),
                    year: article.Journal.JournalIssue.PubDate.Year,
                    url: `https://pubmed.ncbi.nlm.nih.gov/${art.MedlineCitation.PMID._ || art.MedlineCitation.PMID}/`,
                    source: 'PubMed',
                    type: 'publication'
                };
            });
        } catch (error) {
            console.error('PubMed Error:', error.message);
            return [];
        }
    }

    async fetchOpenAlex(query) {
        try {
            // Fetching a broad pool from OpenAlex (50 candidates)
            const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=50&sort=relevance_score:desc`;
            const res = await axios.get(url);
            
            return res.data.results.map(work => ({
                title: work.title,
                abstract: '', // OpenAlex doesn't always provide full abstract in search
                authors: work.authorships.map(a => a.author.display_name),
                year: work.publication_year.toString(),
                url: work.doi || work.id,
                source: 'OpenAlex',
                type: 'publication'
            }));
        } catch (error) {
            console.error('OpenAlex Error:', error.message);
            return [];
        }
    }

    async fetchClinicalTrials(condition, intentQuery) {
        try {
            // Using query.cond for the explicit disease and query.term for the intent (e.g. Deep Brain Stimulation)
            const url = `https://clinicaltrials.gov/api/v2/studies?query.cond=${encodeURIComponent(condition || '')}&query.term=${encodeURIComponent(intentQuery || '')}&pageSize=50&format=json`;
            const res = await axios.get(url);
            
            return (res.data.studies || []).map(study => {
                const protocol = study.protocolSection;
                return {
                    title: protocol.identificationModule.officialTitle || protocol.identificationModule.briefTitle,
                    status: protocol.statusModule.overallStatus,
                    eligibility: protocol.eligibilityModule?.eligibilityCriteria || 'Not specified',
                    location: protocol.contactsLocationsModule?.locations?.[0]?.facility || 'Multiple Locations',
                    contact: protocol.contactsLocationsModule?.centralContacts?.[0]?.email || 'N/A',
                    url: `https://clinicaltrials.gov/study/${protocol.identificationModule.nctId}`,
                    source: 'ClinicalTrials.gov',
                    type: 'trial'
                };
            });
        } catch (error) {
            console.error('ClinicalTrials Error:', error.message);
            return [];
        }
    }

    rankAndFilter(pubmed, openAlex, trials, query) {
        // 1. Merge all 150+ raw publications retrieved via algorithmic relevance
        const rawPublications = [...pubmed, ...openAlex];
        
        // 2. Filter: Remove malformed data and distinct URL deduplication
        const validPublications = rawPublications.filter(p => p.title && p.url);
        const uniquePublications = _.uniqBy(validPublications, 'url');

        // 3. Multi-Factor Intelligent Ranking (Recency + Credibility)
        const currentYear = new Date().getFullYear();
        const scoredPubs = uniquePublications.map(pub => {
            let score = 0;
            const pubYear = parseInt(pub.year) || 0;

            // Factor A: Recency (Higher score for newer studies)
            if (pubYear >= currentYear - 2) score += 50; 
            else if (pubYear >= currentYear - 5) score += 30;
            else if (pubYear >= currentYear - 10) score += 10;
            
            // Factor B: Source Credibility (PubMed gets a boost over open access nodes)
            if (pub.source === 'PubMed') score += 25;

            // Factor C: Relevance is inherently preserved from the API sorting order
            return { ...pub, rankingScore: score };
        });

        // Sort by computed Score first, then strictly newest Year as a tie-breaker
        const rankedPubs = _.orderBy(scoredPubs, ['rankingScore', 'year'], ['desc', 'desc']).slice(0, 10);
        
        // 4. Rank Trials: (Active Recruiting trials naturally bubble up via API)
        const validTrials = trials.filter(t => t.url);
        const rankedTrials = validTrials.slice(0, 10);

        return {
            publications: rankedPubs,
            trials: rankedTrials
        };
    }
}

module.exports = new RetrievalService();
