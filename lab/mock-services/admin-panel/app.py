from flask import Flask, make_response

app = Flask(__name__)


@app.get("/")
def index():
    html = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Admin Panel</title>
  </head>
  <body>
    <main>
      <h1>Internal Administration Portal</h1>
      <p>This mock page is for local SpectraScope detection tests only.</p>
    </main>
  </body>
</html>
"""
    response = make_response(html)
    response.headers["X-Spectra-Finding"] = "exposed-admin-panel"
    return response


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
