from flask import Flask, make_response

app = Flask(__name__)


@app.get("/")
def index():
    html = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Legacy Service</title>
  </head>
  <body>
    <main>
      <h1>Legacy Service</h1>
      <p>Demonstration service for local SpectraScope risk scoring tests.</p>
    </main>
  </body>
</html>
"""
    response = make_response(html)
    response.headers["Server"] = "Apache/2.4.49"
    response.headers["X-Spectra-Finding"] = "legacy-service"
    return response


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
