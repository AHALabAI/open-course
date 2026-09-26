"""Regression check for browser-readable UTF-8 documentation. MIT license."""
from functools import partial
from http.server import ThreadingHTTPServer
from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from threading import Thread
from urllib.request import urlopen
import unittest


class DocumentEncodingTests(unittest.TestCase):
    def test_each_game_serves_its_readme_as_utf8(self):
        code = Path(__file__).resolve().parents[1]
        for game in ("paper-maze", "animal-garden"):
            with self.subTest(game=game):
                folder = code / game
                spec = spec_from_file_location(game.replace("-", "_"), folder / "serve.py")
                module = module_from_spec(spec)
                spec.loader.exec_module(module)
                server = ThreadingHTTPServer(
                    ("127.0.0.1", 0), partial(module.Handler, directory=str(folder))
                )
                worker = Thread(target=server.serve_forever, daemon=True)
                worker.start()
                try:
                    with urlopen(f"http://127.0.0.1:{server.server_port}/README.md") as response:
                        self.assertEqual(response.headers.get_content_type(), "text/plain")
                        self.assertEqual(response.headers.get_content_charset(), "utf-8")
                        text = response.read().decode(response.headers.get_content_charset())
                    self.assertEqual(text, (folder / "README.md").read_bytes().decode("utf-8"))
                    self.assertNotIn("\ufffd", text)
                finally:
                    server.shutdown()
                    server.server_close()
                    worker.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
