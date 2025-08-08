# seraict

실행 방법
1. 사전 준비:

컴퓨터에 Python (버전 3.12 이상)이 설치되어 있어야 합니다.
코드는 multimodal_rag_app 디렉터리에 저장되어 있다고 가정합니다.
2. uv 설치:

프로젝트의 가상환경과 패키지를 관리하기 위해 uv를 사용합니다. 터미널(명령 프롬프트 또는 PowerShell)을 열고 아래 명령어로 uv를 설치하세요.
pip install uv
3. 프로젝트 폴더로 이동:

터미널에서 코드가 있는 multimodal_rag_app 폴더로 이동하세요.
cd path/to/multimodal_rag_app
4. 의존성 패키지 설치:

아래 명령어를 실행하여 uv가 가상환경을 만들고 pyproject.toml 파일에 명시된 모든 필수 패키지를 자동으로 설치하도록 합니다.
uv sync
5. Anthropic (Claude) API 키 설정:

이 애플리케이션은 Claude AI 모델을 사용하므로 Anthropic API 키가 필요합니다.

아래와 같이 환경 변수로 API 키를 설정해주세요. (YOUR_CLAUDE_API_KEY 부분을 실제 키로 교체해야 합니다.)

Windows (CMD):
set ANTHROPIC_API_KEY=YOUR_CLAUDE_API_KEY
Windows (PowerShell):
$env:ANTHROPIC_API_KEY="YOUR_CLAUDE_API_KEY"
macOS / Linux:
export ANTHROPIC_API_KEY='YOUR_CLAUDE_API_KEY'
6. 웹 서버 실행:

모든 설정이 완료되었습니다. 아래 명령어를 실행하여 웹 서버를 시작하세요.
uv run uvicorn main:app --host 0.0.0.0 --port 8000
서버가 시작되면 Application startup complete.와 같은 메시지가 보일 것입니다.
7. 애플리케이션 접속:

웹 브라우저를 열고 주소창에 아래 주소를 입력하세요.
http://localhost:8000
이제 웹 UI를 통해 데이터를 업로드하고 챗봇과 대화할 수 있습니다.

실행결과
1. 데이터 입력은 string 차원의 텍스트, 그리고 파일로 image와 video를 업로드 한다.
2. 업로드된 이미지와 Video는 DB에 저장하지 않고 목록만 가지고 있는 형태다.
3. 채팅 창을 통해서는 모든 대화가 Text만으로 이루어진다. 즉 이 창에서는 이미지나 비디오가 보여지지 않는다.
