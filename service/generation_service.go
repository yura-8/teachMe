package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/joho/godotenv"
	"google.golang.org/genai"

	"teachMe/model"
)

type GenerationHistorySaver interface {
	Create(ctx context.Context, gh *model.GenerationHistory) error
}

type GenerationService struct {
	Repo GenerationHistorySaver
}

func NewGenerationService(repo GenerationHistorySaver) *GenerationService {
	return &GenerationService{Repo: repo}
}

type MailDraft struct {
	Level   int    `json:"level"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

type GenerateAndSaveResult struct {
	History *model.GenerationHistory
	Draft   MailDraft
	Raw     string
}

func (s *GenerationService) GenerateAndSave(
	ctx context.Context,
	prompt string,
	useGemini bool,
	sliderValue int,
	userID uint64,
	emailListID uint64,
	myEmailListID uint64,
) (*GenerateAndSaveResult, error) {
	raw, err := generateText(ctx, useGemini, prompt, sliderValue)
	if err != nil {
		return nil, err
	}

	draft := parseAndValidateMailDraft(raw, sliderValue, prompt)

	gh := &model.GenerationHistory{
		UserID:        userID,
		EmailListID:   emailListID,
		MyEmailListID: myEmailListID,
		// Schema stores only Content, so persist the body portion.
		Content: draft.Body,
	}

	if err := s.Repo.Create(ctx, gh); err != nil {
		return nil, fmt.Errorf("failed to save generated text: %w", err)
	}

	return &GenerateAndSaveResult{
		History: gh,
		Draft:   draft,
		Raw:     raw,
	}, nil
}

func generatePrompt(prompt string, slider_value int) string {
	// sliderの値（5段階）によって反省度を変える
	base_prompt := "指示: ユーザーから入力された「本音（言い訳）」を、変換ルールに応じて、大学教授に送るための論理的かつ誠実な文章に変換してください。"

	base_prompt += "本音: " + prompt + "。" // ここにユーザーの入力を追加

	base_prompt += "変換ルール: "
	if slider_value == 1 {
		base_prompt += "「確認が不十分でした」といった、不注意を認める比較的ソフトな表現。"
	} else if slider_value == 2 {
		base_prompt += "「スケジュール管理の優先順位付けに甘さがあった」という、一段階上の社会性を備えた表現。"
	} else if slider_value == 3 {
		base_prompt += "「自己管理能力の欠如を痛感しており、深く反省しております」という、標準的で硬い表現。"
	} else if slider_value == 4 {
		base_prompt += "「教授の貴重なご指導の機会を無下にし、信頼を著しく損ねた」という、相手への影響を強調する重い表現。"
	} else if slider_value == 5 {
		base_prompt += "「学問を志す身としてあるまじき失態であり、万死に値する」といった、辞世の句のような悲壮感漂う表現。"
	}

	base_prompt += "制約事項:本音（寝坊、忘れていた等）をそのまま書かず、医学的、心理学的、または論理的な語彙（例：概日リズム、情報処理のボトルネック、不可抗力的なリソース不足）に変換すること。出力は必ず次のJSON構造で出力すること。"
	base_prompt += "構造化出力フォーマット（例）"
	base_prompt += `{
			"level": 1,
			"subject": "（反省文をメールで送る時の件名が入ります）",
			"body": "（ここに生成された本文が入ります）"
			}`

	// 出力例
	base_prompt += "出力例を示します。"
	base_prompt += "本音: ゲームをしていたら、課題を出し忘れた。"
	if slider_value == 1 {
		base_prompt += `{
			"level": 1,
			"subject": "課題の提出遅延について",
			"body": "いつもご指導ありがとうございます。本日の課題提出について、私の不注意により期限を失念しておりました。以後、リマインダーの設定を徹底し、二度とこのようなことがないよう努めます。遅ればせながら資料を添付いたしましたので、ご査収いただけますと幸いです。"
			}`
	} else if slider_value == 2 {
		base_prompt += `{
			"level": 1,
			"subject": "課題の提出遅延について",
			"body": "本日の課題提出が遅れましたこと、深くお詫び申し上げます。スケジュール管理における優先順位の設定に甘さがあり、提出完了までのフローを正確に把握できておりませんでした。自身の確認不足を真摯に受け止め、以後の再発防止を徹底いたします。"
			}`
	} else if slider_value == 3 {
		base_prompt += `{
			"level": 1,
			"subject": "課題提出の遅延に関するお詫びとご報告",
			"body": "平素より格別のご指導を賜り、厚く御礼申し上げます。本日の課題提出に際し、自己管理能力の欠如により期限を遵守できず、多大なるご迷惑をおかけいたしました。概日リズムの一時的な乱れからくる判断力の低下を露呈し、深く反省しております。今後は生活習慣を見直し、学業への臨戦態勢を再構築する所存です。"
			}`
	} else if slider_value == 4 {
		base_prompt += `{
			"level": 1,
			"subject": "課題未提出という重大な失態について",
			"body": "この度、学業を最優先すべき学生としての本分を忘れ、課題提出を怠るという重大な失態を演じてしまいました。教授が心血を注いでくださるご指導に対し、このような怠慢で報いる形となったこと、慙愧に堪えません。自身の甘えが招いた環境の破綻を深く恥じ、信頼回復に向けて全身全霊で取り組むことを誓います。"
			}`
	} else if slider_value == 5 {
		base_prompt += `{
			"level": 1,
			"subject": "学問の徒としてあるまじき大過についての辞世の句",
			"body": "本件、もはや言葉を尽くしても贖えぬ大罪であり、学問を志す身として万死に値する失態であると痛感しております。真理を探究する神聖な場において、己の未熟さゆえに醜態を晒し、教授の気高き尊厳を汚してしまいました。この恥辱を一生涯の教訓とし、己の存在を根底から叩き直す所存です。何卒、寛大なるご処置を伏してお願い申し上げます。"
			}`
	}

	return fmt.Sprintf("%s", base_prompt)
}

func generateText(ctx context.Context, useGemini bool, prompt string, slider_value int) (string, error) {
	if useGemini {
		_ = godotenv.Load()

		ctx := context.Background()
		client, err := genai.NewClient(ctx, nil)
		if err != nil {
			return "", fmt.Errorf("error creating Gemini client: %w", err)
		}

		send_message := generatePrompt(prompt, slider_value)

		response, err := client.Models.GenerateContent(
			ctx,
			"gemini-2.5-flash-lite",
			genai.Text(send_message), // prompt
			nil,
		)
		if err != nil {
			return "", fmt.Errorf("error generating text: %w", err)
		}

		return string(response.Text()), nil
	}

	// Dummy output: vary by slider_value so UI can be tested without Gemini.
	switch slider_value {
	case 1:
		return `{"level":1,"subject":"課題の提出遅延について","body":"課題の提出が遅れてしまい申し訳ありません。確認が不十分でした。すぐに提出いたします。今後はリマインダーを設定します。"} `, nil
	case 2:
		return `{"level":2,"subject":"課題提出遅延のお詫び","body":"課題の提出が遅れ、申し訳ありません。スケジュール管理の優先順位付けに甘さがありました。直ちに提出し、以後は管理方法を見直します。"} `, nil
	case 3:
		return `{"level":3,"subject":"課題提出遅延に関するお詫び","body":"課題の提出が遅れ、深くお詫び申し上げます。自己管理能力の欠如を痛感しており、再発防止のため提出手順とリマインダーを整備します。直ちに提出いたします。"} `, nil
	case 4:
		return `{"level":4,"subject":"課題未提出という重大な失態について","body":"課題を期限内に提出できず、誠に申し訳ございません。ご指導の機会を無下にし、信頼を損ねる行為でした。直ちに提出し、今後は計画と確認を徹底します。"} `, nil
	case 5:
		return `{"level":5,"subject":"深い反省とお詫び","body":"課題未提出という失態を重く受け止めております。学ぶ姿勢そのものを改め、二度と同様の不手際が起きぬよう生活と学習計画を抜本的に見直します。直ちに提出いたします。"} `, nil
	default:
		return `{"level":0,"subject":"テスト（GeminiAPI 未使用）","body":"slider_value(反省度)を 1-5 で指定してください。"} `, nil
	}
}

func parseAndValidateMailDraft(raw string, sliderValue int, prompt string) MailDraft {
	raw = strings.TrimSpace(raw)
	draft := MailDraft{Level: sliderValue}

	// Gemini can wrap JSON in code fences or include extra text.
	jsonCandidate := extractFirstJSONObject(raw)
	if jsonCandidate != "" {
		var parsed MailDraft
		if err := json.Unmarshal([]byte(jsonCandidate), &parsed); err == nil {
			if strings.TrimSpace(parsed.Subject) != "" {
				draft.Subject = strings.TrimSpace(parsed.Subject)
			}
			if strings.TrimSpace(parsed.Body) != "" {
				draft.Body = strings.TrimSpace(parsed.Body)
			}
			if parsed.Level != 0 {
				draft.Level = parsed.Level
			}
		}
	}

	// Ensure both fields are always available.
	if strings.TrimSpace(draft.Subject) == "" {
		draft.Subject = "課題提出に関するお詫び"
	}
	if strings.TrimSpace(draft.Body) == "" {
		switch {
		case raw != "":
			draft.Body = raw
		case strings.TrimSpace(prompt) != "":
			draft.Body = strings.TrimSpace(prompt)
		default:
			draft.Body = "申し訳ありません。"
		}
	}

	return draft
}

func extractFirstJSONObject(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}

	// Handle ```json ... ``` or ``` ... ``` blocks.
	if idx := strings.Index(s, "```"); idx >= 0 {
		rest := strings.TrimSpace(s[idx+3:])
		if strings.HasPrefix(strings.ToLower(rest), "json") {
			rest = strings.TrimSpace(rest[4:])
		}
		if end := strings.Index(rest, "```"); end >= 0 {
			s = strings.TrimSpace(rest[:end])
		}
	}

	start := strings.IndexByte(s, '{')
	end := strings.LastIndexByte(s, '}')
	if start < 0 || end < 0 || end <= start {
		return ""
	}
	return strings.TrimSpace(s[start : end+1])
}
