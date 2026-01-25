package handler

import (
	"fmt"
	"net/http"
)

func TextGenerationHandler(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "文章生成")
}