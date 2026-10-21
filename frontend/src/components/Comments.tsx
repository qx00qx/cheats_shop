import React, { useState } from "react";
import { Button } from "./Button";
import { Input, TextArea } from "./Input";
import { useSubmitForm } from "../hooks/useApi";
import { useToast } from "../hooks/useToast";

interface Comment {
  id: string;
  author: string;
  text: string;
  date: string;
  rating?: number;
}

interface CommentsProps {
  productId: string | number;
  initialComments?: Comment[];
  addCommentEndpoint?: string;
  addReviewEndpoint?: string;
  className?: string;
}

export const Comments: React.FC<CommentsProps> = ({
  productId,
  initialComments = [],
  addCommentEndpoint = "/ajax/addcomment",
  addReviewEndpoint = "/ajax/additemreview",
  className = "",
}) => {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [isAddingReview, setIsAddingReview] = useState(false);
  const { submit, isLoading } = useSubmitForm();
  const { success, error } = useToast();

  const handleAddComment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await submit(addCommentEndpoint, data);
      if (response.success) {
        success(response.msg || "Комментарий добавлен");
        e.currentTarget.reset();
        setIsAddingComment(false);
        // В реальном проекте здесь нужно добавить новый комментарий в список
      } else {
        error(response.error || "Ошибка добавления комментария");
      }
    } catch (err) {
      error("Произошла ошибка");
    }
  };

  const handleAddReview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      const response = await submit(addReviewEndpoint, data);
      if (response.success) {
        success(response.msg || "Отзыв добавлен");
        e.currentTarget.reset();
        setIsAddingReview(false);
        // В реальном проекте здесь нужно добавить новый отзыв в список
      } else {
        error(response.error || "Ошибка добавления отзыва");
      }
    } catch (err) {
      error("Произошла ошибка");
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Comments Section */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Комментарии</h3>

        {comments.length > 0 ? (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{comment.author}</span>
                  <span className="text-sm text-gray-500">{comment.date}</span>
                </div>
                <p className="text-gray-700">{comment.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Комментариев пока нет</p>
        )}

        {!isAddingComment && (
          <Button
            variant="secondary"
            onClick={() => setIsAddingComment(true)}
            className="mt-4"
          >
            Добавить комментарий
          </Button>
        )}

        {isAddingComment && (
          <form onSubmit={handleAddComment} className="mt-4 space-y-4">
            <Input
              name="author"
              label="Ваше имя"
              required
              fullWidth
            />
            <TextArea
              name="text"
              label="Комментарий"
              required
              rows={4}
              fullWidth
            />
            <input type="hidden" name="productId" value={productId} />
            <div className="flex gap-2">
              <Button type="submit" loading={isLoading}>
                Отправить
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsAddingComment(false)}
              >
                Отмена
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Reviews Section */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Отзывы</h3>

        {!isAddingReview && (
          <Button
            variant="secondary"
            onClick={() => setIsAddingReview(true)}
          >
            Оставить отзыв
          </Button>
        )}

        {isAddingReview && (
          <form onSubmit={handleAddReview} className="mt-4 space-y-4">
            <Input
              name="author"
              label="Ваше имя"
              required
              fullWidth
              className="clearVal"
            />
            <TextArea
              name="text"
              label="Отзыв"
              required
              rows={4}
              fullWidth
              className="clearVal"
            />
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Оценка:
              </label>
              <select
                name="rating"
                className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                required
              >
                <option value="5">5 - Отлично</option>
                <option value="4">4 - Хорошо</option>
                <option value="3">3 - Средне</option>
                <option value="2">2 - Плохо</option>
                <option value="1">1 - Ужасно</option>
              </select>
            </div>
            <input type="hidden" name="productId" value={productId} />
            <div className="flex gap-2">
              <Button type="submit" loading={isLoading}>
                Отправить отзыв
              </Button>
              <Button
                variant="ghost"
                onClick={() => setIsAddingReview(false)}
              >
                Отмена
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
