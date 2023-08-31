
function word_in_tags (word, text) {
    if (text == "") {
        return false;
    }
    words = text.split(" ");
    return words.includes(word);
}

module.exports = word_in_tags;
