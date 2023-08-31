function convert_text_to_tag_string (text) {
    if (text == "") {
        return ""
    }
    words = text.split(" ");
    return words.map(w => "#" + w).join(" ");
}

module.exports = convert_text_to_tag_string;
