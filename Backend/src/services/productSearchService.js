const normalize = (value = '') => String(value).toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const words = (value) => normalize(value).split(/\s+/).filter(Boolean);

const closeWord = (wanted, actual) => {
  if (wanted === actual || actual.startsWith(wanted) || wanted.startsWith(actual) && actual.length >= 3) return true;
  if (wanted.length < 4 || actual.length < 4 || Math.abs(wanted.length - actual.length) > 1) return false;
  // One insertion, removal, or substitution covers common typing mistakes.
  let i = 0, j = 0, edits = 0;
  while (i < wanted.length && j < actual.length) {
    if (wanted[i] === actual[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (wanted.length >= actual.length) i++;
    if (actual.length >= wanted.length) j++;
  }
  return edits + (wanted.length - i) + (actual.length - j) <= 1;
};

export const rankSearchProducts = (products, query) => {
  const queryWords = words(query);
  const phrase = normalize(query);
  if (!queryWords.length) return [];

  const matchingBrand = products
    .map(p => normalize(p.brandName))
    .filter(brand => brand && (phrase === brand || phrase.startsWith(`${brand} `)))
    .sort((a, b) => b.length - a.length)[0] || '';
  // Catalog imports sometimes omit brandName. A full name beginning with the query
  // still lets us infer the brand for multi-word product searches.
  const inferredBrand = !matchingBrand && queryWords.length > 1 && products.some(p => normalize(p.name).startsWith(phrase))
    ? queryWords[0] : '';
  const brand = matchingBrand || inferredBrand;
  const typeWords = words(phrase.slice(brand.length)).filter(word => !['of', 'and', 'the', 'with'].includes(word));

  return products.map(product => {
    const name = normalize(product.name);
    const brandName = normalize(product.brandName);
    const nameWords = words(product.name);
    const typeFields = [...nameWords, ...words(product.tags?.join(' '))];
    const typeMatches = typeWords.filter(word => typeFields.some(candidate => closeWord(word, candidate))).length;
    const exact = name === phrase;
    const phraseMatch = name.includes(phrase);
    const sameBrand = Boolean(brand && (brandName === brand || name.startsWith(`${brand} `)));
    const brandOnly = Boolean(brand && !typeWords.length && sameBrand);
    const categoryMatch = !brand && !typeMatches && (normalize(product.category) === phrase || normalize(product.subCategory) === phrase);
    // A brand plus product type must not return unrelated goods from that brand.
    if (!exact && !phraseMatch && !brandOnly && !categoryMatch && !typeMatches) return null;
    const productType = typeWords.at(-1);
    if (productType && !exact && !phraseMatch && !typeFields.some(candidate => closeWord(productType, candidate))) return null;

    const tier = exact ? 5 : phraseMatch && sameBrand ? 4 : sameBrand && typeWords.length ? 3 : typeMatches ? 2 : 1;
    const stock = product.isDeliverable ?? (product.vendor ? product.stock > 0 : product.branchStocks?.some(s => s.stock > 0));
    const score = tier * 1000 + (stock ? 100 : 0) + typeMatches * 20 + (phraseMatch ? 10 : 0);
    return { product, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score || String(a.product.name).localeCompare(String(b.product.name)))
    .map(({ product }) => product);
};
