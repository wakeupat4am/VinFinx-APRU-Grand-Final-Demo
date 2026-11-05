# VinFinx — APRU Grand Final Demo

**VinFinx × Vietcombank / MyWealth** — bản demo độc lập để một thành viên trong nhóm clone về, chạy trên máy mình và quay ba vai trò. Giao diện ứng dụng bằng **tiếng Anh**, gồm web và bản xem trước iPhone, mascot Finx, chế độ sáng/tối, chữ lớn, hướng dẫn tám bước và phần giải thích có thể mở rộng.

> Đây là prototype nghiên cứu dùng hồ sơ giả lập. Định giá dùng **LightGBM thật chạy CPU**; giá là ước tính từ giá chào bán lịch sử. Điểm tài chính là bộ quy tắc demo. Kết quả không phải thẩm định chính thức, điểm tín dụng ngân hàng hay phê duyệt khoản vay.

## 1. Bắt đầu nhanh — macOS / Linux

Bạn cần quyền truy cập **repo private này**, Python **3.12**, Git và GitHub CLI (`gh`). Không cần VPN hay GPU để chạy định giá, tài chính, PDF mẫu, báo cáo và Ask Finx ở Evidence mode.

Trên macOS nếu chưa có các công cụ, cài bằng Homebrew:

```bash
brew install python@3.12 gh libomp tesseract
```

Trên Ubuntu, cài Git/GitHub CLI, Python 3.12 với module `venv`, `libgomp1` và `tesseract-ocr` theo kho phần mềm của hệ điều hành. Đừng thay Python hệ thống. Máy khác macOS đã được thiết kế để dùng Tesseract nhưng cần chạy kiểm tra bên dưới trên chính máy quay.

```bash
gh auth login
gh repo clone wakeupat4am/VinFinx-APRU-Grand-Final-Demo
cd VinFinx-APRU-Grand-Final-Demo
python3.12 setup_demo.py
.venv/bin/python demo.py accounts
.venv/bin/python demo.py serve
```

`setup_demo.py` làm bốn việc:

1. Tải `vinfinx-demo-assets-v1.zip` từ GitHub Release **demo-v1** của repo private này.
2. Kiểm tra SHA-256 của ZIP và từng file bằng `assets.lock.json` trước khi sử dụng model.
3. Tạo `.venv`, cài dependencies, chạy `pip check`.
4. Tạo cơ sở dữ liệu, 10 tài khoản và sáu bản lương PDF/PNG **mới, giả lập**. Không sao chép tài khoản hay hồ sơ của người phát triển.

Giữ terminal chạy server mở. Khi thấy thông báo `pilot listening`, mở:

| Giao diện | Địa chỉ mặc định |
| --- | --- |
| Web | http://127.0.0.1:4176/ |
| iPhone preview | http://127.0.0.1:4176/?demo=ios |

Đây là web chạy trong trình duyệt, **không phải app iOS native**. Trên desktop có khung iPhone; trên màn hình điện thoại nhỏ, ứng dụng dùng toàn bộ viewport. Link `127.0.0.1` trỏ về máy đang chạy server, không phải một tên miền công khai.

Nếu chủ repo đưa ZIP qua kênh riêng thay vì tải bằng `gh`:

```bash
python3.12 setup_demo.py --assets /absolute/path/vinfinx-demo-assets-v1.zip
```

ZIP phải đúng phiên bản trong `assets.lock.json`. Không tải model pickle/joblib từ nguồn lạ; đây là định dạng có khả năng thực thi mã. Source code và assets phải cùng phiên bản phát hành.

### Windows

Có thể thử với Python 3.12 và GitHub CLI, dùng các lệnh tương ứng:

```powershell
py -3.12 setup_demo.py
.venv\Scripts\python.exe demo.py accounts
.venv\Scripts\python.exe demo.py serve
```

Windows chưa được kiểm thử trong lần đóng gói này. PDF text extraction không cần OCR hệ điều hành. Với PNG, cài Tesseract và đặt `VINFINX_TESSERACT` trỏ đến `tesseract.exe`; có thể cần Microsoft Visual C++ runtime cho LightGBM. macOS là môi trường đã kiểm thử của gói này.

## 2. Tài khoản và tên ba vai trò

Chạy `.venv/bin/python demo.py accounts` để xem mật khẩu được tạo **riêng trên máy bạn**. Mật khẩu cũ trong chat của chủ dự án không dùng cho bản clone mới.

| Vai trò thực tế | Tài khoản gợi ý khi quay | Chức năng |
| --- | --- | --- |
| Customer | `customer01@vinfinx.demo` | Định giá, tài chính, giấy tờ, hỏi Finx, mô phỏng vay, xem/xuất báo cáo |
| Advisor | `advisor01@vinfinx.demo` | Xem Customer 01–03 được phân công, giải thích hồ sơ, tư vấn |
| Authenticator / Verifier | `authenticator01@vinfinx.demo` | Kiểm tra giấy tờ/định giá, chấp thuận hoặc từ chối, xem audit log |

**“Auditor” trong trao đổi của nhóm tương ứng chức năng kiểm tra/audit của Authenticator/Verifier.** Ứng dụng không có một role `auditor` riêng. Nếu đang nói đến nhân viên tư vấn, tên role là **Advisor**. Không đổi nhãn bằng cách bỏ kiểm soát quyền.

Đầy đủ có 6 Customer, 2 Advisor, 2 Authenticator. Advisor 02 chỉ được phân công Customer 04–06. Tất cả Customer dùng chung giao diện; dữ liệu, tiến trình hướng dẫn và lựa chọn hiển thị vẫn riêng. Danh sách mật khẩu ở `.demo-state/pilot_accounts.json`, đã được gitignore. Không đưa file này vào video, Git hoặc tin nhắn công khai.

## 3. Chuẩn bị trước khi quay

Trong terminal thứ hai, tại thư mục repo, khi server đang chạy:

```bash
.venv/bin/python demo.py prepare
```

Lệnh này đăng nhập Customer 01 qua API thông thường, chạy định giá thật cho thông tin nhà mẫu và trích xuất PDF lương mẫu rồi gửi chờ duyệt. Lệnh **không phê duyệt** thu nhập. Nếu đã có định giá hoặc tài liệu, nó giữ nguyên. Customer 01 sẽ có dữ liệu để trình diễn; Advisor 01 thấy cùng hồ sơ; Authenticator thấy hàng chờ. Giao diện có thể vẫn yêu cầu bấm `Get price range` để hoàn thành bước nhập nhà trong một walkthrough mới.

Mở màn hình **Check services**: AVM phải `Ready`, database sẵn sàng. Qwen có thể `Offline · Evidence mode`; đây là fallback thật từ dữ liệu đã lưu, không phải câu trả lời LLM giả.

### Ba role mở cùng lúc, không mất thời gian đăng nhập lại

**Safari trên Mac — cách đã kiểm tra:**

1. Mở một cửa sổ Private Browsing mới bằng `⌘⇧N`.
2. Tab 1: mở iPhone URL và đăng nhập Customer 01.
3. Dùng `⌘T` tạo tab mới (không Duplicate Tab), mở web URL và đăng nhập Advisor 01.
4. Tạo tab thứ ba tương tự, đăng nhập Authenticator 01.
5. Tải lại từng tab một lần để chắc chắn vẫn đúng role. Chuyển bằng **⌘1 / ⌘2 / ⌘3**.
6. Giữ nguyên cửa sổ trong lúc quay; không đóng các tab private.

**Chrome/Edge:** dùng ba browser profile tách biệt hoặc ba trình duyệt khác nhau. Ba tab thường cùng origin chia sẻ cookie; nhiều cửa sổ Incognito cùng một phiên cũng có thể chia sẻ đăng nhập. Đổi cổng đơn thuần không tách cookie. Không dùng cách bỏ đăng nhập để quay.

Phiên đăng nhập hiện có thời hạn 8 giờ. Chuẩn bị lại trước buổi quay nếu đã để qua đêm. Đăng nhập trên web và iPhone URL trong cùng một browser profile dùng chung tài khoản — hai giao diện cùng backend.

## 4. Kịch bản quay 2 phút

Đây là gợi ý thời lượng, không phải số đo hoàn thành tác vụ thực nghiệm.

| Mốc | Role | Thao tác và nội dung cần nhấn mạnh |
| --- | --- | --- |
| 00:00–00:10 | Customer | Mở `Your goal today`, chọn tìm hiểu giá nhà. Finx dẫn từng bước, có chữ in đậm và nút lớn. |
| 00:10–00:30 | Customer | Xem/sửa thông tin mẫu, `Get price range`, Next. Chỉ ra khoảng giá và mở yếu tố ảnh hưởng. Đây là giá chào bán ước tính. |
| 00:30–00:45 | Customer | Đến giấy tờ. Cho thấy bản lương mẫu và trạng thái chờ người duyệt. PDF trích xuất text; PNG mới là image OCR. |
| 00:45–01:00 | Customer | Xem điểm, `Left each month`, mở score breakdown; chuyển đến mô phỏng trả nợ với giả định. |
| 01:00–01:20 | Customer | Hỏi một câu gợi ý trong Ask Finx; mở bước báo cáo. Chỉ xuất sau khi đọc và đồng ý. |
| 01:20–01:40 | Advisor | `⌘2`: chọn Customer 01, chỉ ra hồ sơ được phân công, score breakdown và lựa chọn tư vấn. |
| 01:40–02:00 | Authenticator | `⌘3`: mở số liệu và nguồn trên bản lương; minh họa bước con người xác minh, sau đó audit log nếu đủ thời gian. |

Nếu bấm `Verify sample income`, dữ liệu demo thật sự thay đổi: thu nhập lấy từ bản lương mẫu, điểm tính lại theo quy tắc. Sau đó refresh các tab khác để xem thay đổi. **Đừng duyệt trước khi quay** nếu muốn quay trạng thái pending. Việc điểm tăng sau xác minh chỉ là thay đổi bằng chứng/đầu vào, không chứng minh tài chính thực tế của khách hàng đã cải thiện.

Để quay lại từ hồ sơ sạch, dùng một thư mục trạng thái **mới**, không xóa trạng thái đang dùng:

```bash
# Dừng server hiện tại bằng Ctrl+C trước.
.venv/bin/python demo.py init --state .demo-state-take2
.venv/bin/python demo.py accounts --state .demo-state-take2
.venv/bin/python demo.py serve --state .demo-state-take2
# Terminal thứ hai:
.venv/bin/python demo.py prepare --state .demo-state-take2
```

Dùng cửa sổ private mới và mật khẩu của take2. Tiến trình guided lưu trong browser theo tài khoản; bộ dữ liệu mới không tự xóa tiến trình browser cũ. Chọn cùng `--state` và `--port` trong mọi lệnh của một lần quay.

## 5. Những gì hoạt động, mô phỏng và chưa triển khai

| Tính năng | Trạng thái và giới hạn |
| --- | --- |
| LightGBM | Inference thật trên CPU, cùng artifact của demo, có native SHAP và hash. Phạm vi nhà đất Hà Nội trong catalog lịch sử. |
| Hierarchical calibration | Tùy chọn residual calibration nghiên cứu trên LightGBM. Không phải pooled structural hierarchy/land-house-macro mới. |
| Financial health | Quy tắc deterministic hiện có, giải thích thành phần và version; hồ sơ đầu vào giả lập/tự khai. Không là credit score chính thức. |
| Peer percentile | So sánh với 100 điểm giả lập, có nhãn. Không có cohort khách hàng ngân hàng thật. |
| Documents | Sáu PDF/PNG có watermark, tạo tại thời điểm setup. PDF text extraction hoạt động; PNG cần Tesseract hoặc Apple Vision. Chỉ mẫu tích hợp được nhận. |
| Human review | Có thật. OCR_PENDING không được tự chuyển thành HUMAN_VERIFIED. Authenticator phải duyệt. |
| Ask Finx | Giải thích và điều hướng theo evidence. Không có Qwen thì fallback deterministic có nhãn; có Qwen thì JSON/ID/action vẫn bị kiểm tra. |
| Borrowing | Mô phỏng deterministic, giả định lãi suất/kỳ hạn; không lãi suất live hay phê duyệt tín dụng. |
| Reports | Preview và xuất HTML sau consent, lưu nguồn/trạng thái/snapshot. Có thể Print → Save as PDF từ trình duyệt. |
| Map | Leaflet nội bộ, basemap OpenStreetMap cần internet. Giá là thống kê lịch sử, marker có thể là vị trí gần đúng của quận; không phải nhà rao bán live của agent. |
| Macro research console | Trang thông báo thiếu tích hợp (safe stub). API 8062/corpus không nằm trong gói này; không coi đây là tính năng live của bản clone. |
| Banking / native iOS | Không có API ngân hàng, lịch sử giao dịch thật hay bản cài iOS. |

Khoảng dự đoán nominal 90% **không** có nghĩa “chắc chắn đúng 90%”. Benchmark nghiên cứu riêng trên giá chào bán có MedAPE 33.35%, coverage thực nghiệm khoảng 83.5%; không coi đó là độ chính xác đã xác nhận của mọi đầu vào/mọi bản model. Macro chưa điều chỉnh giá hay điểm khách hàng trong bản này.

## 6. Qwen tùy chọn

Bản cơ bản chạy được khi Qwen vắng mặt. Không đưa giấy tờ/hồ sơ khách hàng đến OpenAI hoặc dịch vụ LLM bên ngoài.

Nếu đã có quyền vào máy chạy Qwen3.5-9B ở loopback 8061, mở tunnel trong terminal riêng:

```bash
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=20 \
  -L 127.0.0.1:8061:127.0.0.1:8061 YOUR_AUTHORIZED_SSH_ALIAS
```

Sau đó, trong terminal chạy app:

```bash
export VINFINX_QWEN_URL=http://127.0.0.1:8061/vinfinx-api
export VINFINX_QWEN_ORIGIN=http://127.0.0.1:4176
.venv/bin/python demo.py serve
```

Origin phải được server Qwen cho phép. URL loopback là bắt buộc. Không có private key, token, mật khẩu server, địa chỉ nội bộ hoặc Qwen weights trong repo. Không mở port 8061 công khai. Kiểm tra **một câu hỏi thực tế** và mode trả về; health endpoint online chưa chứng minh mọi lần generation thành công.

Adapter ở `prototype/vinfinx/qwen_api.py`. Hướng dẫn dành cho người vận hành GPU: [docs/QWEN.md](docs/QWEN.md). Người chỉ quay demo không cần cài PyTorch/GPU dependencies vào môi trường app.

## 7. Kiểm thử trước buổi quay

```bash
.venv/bin/python demo.py test
# Nếu có Node.js:
node --test prototype/vinfinx/local_app/test_ui.cjs prototype/vinfinx/local_app/test_ios.cjs prototype/vinfinx/local_app/test_journey.cjs
```

Backend tests tạo database tạm và chạy server ở cổng tạm, kiểm tra model thật, phân quyền và concurrency. Không reset database quay. Đây không phải full production audit hay kiểm thử physical iPhone Safari.

Checklist thủ công:

- Cả ba tab đăng nhập, reload vẫn đúng role.
- Customer 01 có giá và khoảng giá; ward/street thuộc district/ward đã chọn.
- PDF mẫu đang pending; Advisor không thể tự duyệt; Authenticator có hàng chờ.
- Ask Finx có trả lời và nhãn mode đúng tình trạng thực tế.
- Báo cáo có nguồn/trạng thái và yêu cầu consent.
- Kiểm tra iPhone preview, chữ lớn, light/dark; không có nội dung tràn viền.
- Thử thao tác một lượt trước khi bấm Record. Không quay màn hình chứa mật khẩu.

## 8. Dữ liệu, cấu trúc và khởi động lại

```text
README.md                      Hướng dẫn cho người quay
setup_demo.py                  Cài venv, tải/kiểm tra assets, tạo tài khoản
demo.py                        init / accounts / serve / prepare / test
requirements.txt               Runtime app, không gồm Qwen GPU
assets.lock.json               Release và SHA-256 các artifact
prototype/vinfinx/local_app/    Backend, UI chung cho ba role, tests
prototype/vinfinx/qwen_api.py   Adapter Qwen tùy chọn
.runtime/                      Model + catalog tải về, ignored
.demo-state/                   Database, mật khẩu, mẫu, uploads, ignored
.venv/                         Môi trường Python, ignored
```

Model weights, fitted transformer, catalog tổng hợp nằm trong **private Release asset**, không trong lịch sử Git. Không có Phase 1–3 raw datasets, database đang quay của chủ dự án, bank records hay credentials trong bản phát hành. Bộ lương được tạo mới tại setup và có nhãn giả lập rõ ràng. Các file tham số model, gồm hierarchy calibration, được giữ nguyên từ bản demo.

`Ctrl+C` dừng server. Chạy lại `demo.py serve` dùng cùng `.demo-state` sẽ giữ tài khoản, hồ sơ, review và audit. Chạy setup lại giữ state cũ. Không xóa `.demo-state` để “sửa lỗi” nếu cần giữ video/session đang quay.

Nếu 4176 đã được sử dụng:

```bash
.venv/bin/python demo.py serve --port 4187
.venv/bin/python demo.py prepare --port 4187
```

Mở `http://127.0.0.1:4187/?demo=ios`. Server chỉ bind loopback. Việc deploy public/HTTPS là một công việc riêng, không nằm trong quick start này.

## 9. Troubleshooting

| Hiện tượng | Cách xử lý |
| --- | --- |
| Clone/Release báo 404 | Repo private: chủ repo cần thêm GitHub account của bạn làm collaborator; chấp nhận invitation, `gh auth status`. |
| `gh` không tìm thấy | Cài GitHub CLI hoặc nhận ZIP chính xác từ chủ repo và dùng `--assets`. |
| Python không phải 3.12 | Dùng `python3.12` hoặc `py -3.12`, không sửa pin sklearn tùy ý vì transformer đã serialize. |
| LightGBM lỗi `libomp` trên Mac | `brew install libomp`, chạy lại server từ `.venv`. |
| Thiếu model / checksum mismatch | Chạy setup với đúng private release. Không bỏ kiểm tra hash. |
| PNG không đọc được | Cài Tesseract, kiểm tra `tesseract --version`; đặt `VINFINX_TESSERACT` nếu không có trong PATH. Trong lúc đó dùng Text PDF và nói rõ PDF text extraction. |
| `Qwen Offline` | Bản thân app vẫn chạy. Chỉ nói đang dùng Evidence mode; muốn live Qwen phải kiểm tra VPN, quyền SSH, tunnel và service GPU. |
| Tài khoản không đúng | Xem `demo.py accounts` với đúng `--state`; không dùng password từ máy khác. |
| Ba tab đổi cùng role | Tách browser profiles hoặc Safari private tabs mới, rồi đăng nhập lại. |
| Sau sửa UI còn bản cũ | Reload bằng `⌘R`/Ctrl+R. Server trả assets với `Cache-Control: no-store`. |
| Đã duyệt nên mất nút review | Đúng workflow: không duyệt lại cùng record. Dùng state take2 mới để quay lại pending. |
| Finx không biết giá vừa preview | Save and send for review để lưu; chat/report sử dụng bằng chứng đã lưu. |
| Map không tải nền | Cần mạng để lấy OSM tiles. Không ảnh hưởng các engine local. |
| Báo cáo không phải PDF download | Export hiện là HTML; mở file và dùng Print → Save as PDF nếu cần. |

## 10. Quyền sử dụng và bàn giao

Repo private dành cho nhóm dự án và người được mời quay demo. Không tự cấp giấy phép mã nguồn mở hoặc quyền thương hiệu của ngân hàng. Logo đối tác được dùng theo sự cho phép mà chủ dự án cung cấp; không hàm ý app đã được ngân hàng phê duyệt chính thức. Leaflet có license trong `prototype/vinfinx/local_app/assets/vendor/LICENSE.txt`; giữ attribution OpenStreetMap. Không đưa credentials vào commit.

Xem [VALIDATION.md](VALIDATION.md) để biết những gì thực sự đã kiểm thử trong bản đóng gói này. AI handoff gốc được giữ ở `prototype/vinfinx/AI_ENGINEERING_HANDOFF.md`; các phần nghiên cứu mô tả trong đó không mặc nhiên được triển khai trong demo.
