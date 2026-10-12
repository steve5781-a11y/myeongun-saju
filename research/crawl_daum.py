"""다음 운세(fortune.daum.net) 사주 페이지를 Firecrawl로 수집한다.

사용법:  python research/crawl_daum.py
- 상위 폴더의 .env 에서 FIRECRAWL_API_KEY 를 읽는다.
- 결과는 research/daum-fortune/ 에 마크다운과 전체 스크린샷으로 저장된다.
"""
import json, pathlib, urllib.request, urllib.error

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'research' / 'daum-fortune'
ENV = dict(l.split('=', 1) for l in (ROOT / '.env').read_text(encoding='utf-8').splitlines() if '=' in l)
KEY = ENV['FIRECRAWL_API_KEY'].strip()

JOBS = {
    '01_main': {'url': 'https://fortune.daum.net/', 'waitFor': 3000},
    '02_saju_input': {'url': 'https://fortune.daum.net/saju', 'waitFor': 3000},
    # 입력 폼을 채워 제출한 뒤 결과 화면까지 수집
    '03_saju_result': {'url': 'https://fortune.daum.net/saju', 'actions': [
        {'type': 'wait', 'milliseconds': 2000},
        {'type': 'click', 'selector': '#name'}, {'type': 'write', 'text': '홍길동'},
        {'type': 'click', 'selector': '#birth'}, {'type': 'write', 'text': '1990.05.15'},
        {'type': 'click', 'selector': '#time'}, {'type': 'write', 'text': '15:00'},
        {'type': 'click', 'selector': 'button[type=submit]'},
        {'type': 'wait', 'milliseconds': 15000}]},
}


def scrape(name, job):
    payload = {'formats': ['markdown', 'screenshot@fullPage'], **job}
    req = urllib.request.Request('https://api.firecrawl.dev/v1/scrape',
                                 data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
                                 headers={'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json; charset=utf-8'})
    try:
        data = json.load(urllib.request.urlopen(req, timeout=200)).get('data', {})
    except urllib.error.HTTPError as e:
        print(name, 'HTTP', e.code, e.read().decode('utf-8', 'replace'))
        return
    (OUT / f'{name}.md').write_text(data.get('markdown') or '', encoding='utf-8')
    if data.get('screenshot'):
        urllib.request.urlretrieve(data['screenshot'], OUT / f'{name}.png')
    print(name, 'ok')


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    for name, job in JOBS.items():
        scrape(name, job)
