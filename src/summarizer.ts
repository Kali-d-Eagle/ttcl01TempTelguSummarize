/**
 * Telugu and English Extractive Summarization Logic
 */

const TELUGU_STOPWORDS = new Set([
  "మరియు", "కూడా", "ఒక", "ఈ", "ఆ", "అది", "ఇది", "వారు", "వీరు", "నేను", "మేము", "మీరు", "తన", "తనకు", "అతను", "ఆమె", "ఉంది", "ఉన్నాయి", "ఉన్నాడు", "వచ్చింది", "వెళ్ళింది", "చేయాలి", "చేసి", "అని", "అంటే", "కానీ", "లేదా", "యొక్క", "నుండి", "ద్వారా", "కోసం", "గురించి", "ముందు", "తరువాత", "క్రింద", "పైన", "లోపల", "బయట", "వద్ద", "దగ్గర", "వరకు", "ఎప్పుడు", "ఎక్కడ", "ఎలా", "ఎందుకు", "ఏమిటి", "ఎవరు", "ఏ", "కొన్ని", "చాలా", "కొద్దిగా", "ఎక్కువ", "తక్కువ", "మొదటి", "చివరి", "మధ్య", "మొత్తం", "ప్రతి", "అన్ని", "కొంత", "మాత్రమే", "కన్నా", "కంటే", "కలిగి", "ఉన్న", "అయిన", "అయినప్పటికీ", "కాబట్టి", "అందువలన", "అందుకే", "అయితే", "అందులో", "ఇందులో", "ఎందులో", "అక్కడ", "ఇక్కడ", "ఎక్కడ", "అప్పుడు", "ఇప్పుడు", "ఎప్పుడు"
]);

const ENGLISH_STOPWORDS = new Set([
  "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself", "they", "them", "their", "theirs", "themselves", "what", "which", "who", "whom", "this", "that", "these", "those", "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an", "the", "and", "but", "if", "or", "because", "as", "until", "while", "of", "at", "by", "for", "with", "about", "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now"
]);

export type Language = 'telugu' | 'english' | 'mixed';

export interface SummarizationResult {
  summary: string;
  originalSentences: string[];
  summarySentences: string[];
  keywords: { word: string; count: number }[];
  wordFrequencies: { word: string; count: number }[];
  language: Language;
  stats: {
    originalWordCount: number;
    summaryWordCount: number;
    stopwordCount: number;
    meaningfulWordCount: number;
    sentenceLengths: { index: number; length: number }[];
    readingTimeMinutes: number;
    lexicalDensity: number; // meaningful / total
    complexityScore: number; // avg sentence length normalized
    informationDensity: number; // unique words / total words
    sentenceScores: { index: number; score: number }[];
  };
}

export function detectLanguage(text: string): Language {
  const teluguRegex = /[\u0C00-\u0C7F]/;
  const englishRegex = /[a-zA-Z]/;
  
  const hasTelugu = teluguRegex.test(text);
  const hasEnglish = englishRegex.test(text);
  
  if (hasTelugu && hasEnglish) return 'mixed';
  if (hasTelugu) return 'telugu';
  return 'english';
}

export function summarize(text: string, ratio: number = 0.3): SummarizationResult {
  if (!text.trim()) {
    return {
      summary: "",
      originalSentences: [],
      summarySentences: [],
      keywords: [],
      wordFrequencies: [],
      language: 'english',
      stats: {
        originalWordCount: 0,
        summaryWordCount: 0,
        stopwordCount: 0,
        meaningfulWordCount: 0,
        sentenceLengths: [],
        readingTimeMinutes: 0,
        lexicalDensity: 0,
        complexityScore: 0,
        informationDensity: 0,
        sentenceScores: []
      }
    };
  }

  const language = detectLanguage(text);
  const stopwords = language === 'telugu' ? TELUGU_STOPWORDS : language === 'english' ? ENGLISH_STOPWORDS : new Set([...TELUGU_STOPWORDS, ...ENGLISH_STOPWORDS]);

  // 1. Sentence Tokenization
  const sentences = text.split(/[.!?।\n]+/).map(s => s.trim()).filter(s => s.length > 5);
  const sentenceLengths = sentences.map((s, i) => ({ index: i + 1, length: s.split(/\s+/).length }));

  // 2. Word Tokenization & Frequency
  const allWords = text.toLowerCase().match(/[\u0C00-\u0C7F\w]+/g) || [];
  const uniqueWords = new Set(allWords);
  const freqMap: Record<string, number> = {};
  let stopwordCount = 0;
  let meaningfulWordCount = 0;
  
  allWords.forEach(word => {
    if (stopwords.has(word)) {
      stopwordCount++;
    } else if (word.length > 1) {
      meaningfulWordCount++;
      freqMap[word] = (freqMap[word] || 0) + 1;
    }
  });

  // Normalize frequencies
  const maxFreq = Math.max(...Object.values(freqMap), 1);
  const normalizedFreq: Record<string, number> = {};
  for (const word in freqMap) {
    normalizedFreq[word] = freqMap[word] / maxFreq;
  }

  // 3. Sentence Scoring
  const rawSentenceScores: { index: number; score: number; text: string }[] = sentences.map((sentence, index) => {
    const sentenceWords = sentence.toLowerCase().match(/[\u0C00-\u0C7F\w]+/g) || [];
    let score = 0;
    sentenceWords.forEach(word => {
      if (normalizedFreq[word]) {
        score += normalizedFreq[word];
      }
    });
    // Length penalty/bonus (prefer medium-long sentences for extractive)
    const length = sentenceWords.length;
    if (length < 5) score *= 0.5;
    if (length > 10 && length < 30) score *= 1.2;
    
    return { index, score, text: sentence };
  });

  // 4. Ranking & Selection
  const numSentences = Math.max(1, Math.round(sentences.length * ratio));
  const rankedSentences = [...rawSentenceScores].sort((a, b) => b.score - a.score).slice(0, numSentences);
  
  // Re-order by original appearance
  const summarySentences = rankedSentences.sort((a, b) => a.index - b.index).map(s => s.text);
  const summary = summarySentences.join('. ') + (language === 'telugu' ? ' ।' : '.');

  // 5. Keywords & Frequencies
  const wordFrequencies = Object.entries(freqMap)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const keywords = wordFrequencies.slice(0, 10);

  // 6. Advanced Stats
  const originalWordCount = allWords.length;
  const summaryWordCount = summary.split(/\s+/).length;
  const readingTimeMinutes = Math.ceil(originalWordCount / 200);
  
  const lexicalDensity = (meaningfulWordCount / originalWordCount) * 100;
  const avgSentenceLength = originalWordCount / Math.max(sentences.length, 1);
  const complexityScore = Math.min((avgSentenceLength / 25) * 100, 100); // Normalized to 100
  const informationDensity = (uniqueWords.size / originalWordCount) * 100;

  const sentenceScores = rawSentenceScores.map(s => ({ index: s.index + 1, score: s.score }));

  return {
    summary,
    originalSentences: sentences,
    summarySentences,
    keywords,
    wordFrequencies,
    language,
    stats: {
      originalWordCount,
      summaryWordCount,
      stopwordCount,
      meaningfulWordCount,
      sentenceLengths,
      readingTimeMinutes,
      lexicalDensity,
      complexityScore,
      informationDensity,
      sentenceScores
    }
  };
}
