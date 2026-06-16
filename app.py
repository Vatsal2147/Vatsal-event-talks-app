import os
import requests
import feedparser
from flask import Flask, render_template, jsonify

app = Flask(__name__)

# URL for BigQuery release notes RSS/Atom feed
FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/release-notes")
def get_release_notes():
    try:
        # Fetch the feed using requests with a timeout
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        
        # Parse the feed content using feedparser
        feed = feedparser.parse(response.content)
        
        # Check if parsing was successful
        if feed.bozo:
            # feedparser bozo flag is set if XML is not well-formed
            # But it can still sometimes extract data, so we don't necessarily fail immediately
            pass

        notes = []
        for entry in feed.entries:
            # Extract content or summary
            content = ""
            if 'content' in entry and len(entry.content) > 0:
                content = entry.content[0].value
            elif 'summary' in entry:
                content = entry.summary
            
            # Format date: often feedparser parses published_parsed
            date_str = ""
            if 'published' in entry:
                date_str = entry.published
            elif 'updated' in entry:
                date_str = entry.updated

            note = {
                "id": entry.get("id", ""),
                "title": entry.get("title", "No Title"),
                "date": date_str,
                "link": entry.get("link", ""),
                "content": content
            }
            notes.append(note)
            
        return jsonify({
            "success": True,
            "feed_title": feed.feed.get("title", "BigQuery Release Notes"),
            "notes": notes
        })
        
    except requests.exceptions.RequestException as e:
        return jsonify({
            "success": False,
            "error": f"Failed to fetch release notes: {str(e)}"
        }), 500
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"An error occurred: {str(e)}"
        }), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
